/**
 * Market data for Robinhood Chain, read live.
 *
 * Coins come from the Pons launchpad itself: every graduated coin since the
 * factory went live, plus the deepest coins still on their bonding curve from
 * the last week. Their venues are read on chain (curve reserves, Uniswap v4
 * slot0 + liquidity through PoolManager.extsload). DexScreener adds names,
 * 24 h change, volume, and any other pool the coin trades in.
 *
 * Nothing here is invented: a read that fails leaves the field empty.
 */
import {
  createPublicClient,
  encodeAbiParameters,
  fallback,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  type Hex,
} from "viem";
import { MAINNET, PONS, V4, ZERO } from "../chain";
import type { Venue } from "../impact";

const opts = { retryCount: 2, retryDelay: 800, timeout: 20_000 } as const;
const chain = {
  id: MAINNET.id,
  name: MAINNET.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [MAINNET.readRpc] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" as Hex } },
} as const;

/** Reads and multicalls. publicnode serves them but refuses logs. */
const reads = createPublicClient({
  chain,
  transport: fallback([http(MAINNET.readRpc, opts), http(MAINNET.rpc, opts)]),
  batch: { multicall: { batchSize: 2048 } },
});
/** Logs: only the official endpoint serves them. */
const logs = createPublicClient({ chain, transport: http(MAINNET.rpc, opts) });

const factoryAbi = parseAbi([
  "function getLaunchedToken(address token) view returns ((address token,address curve,address deployer,address creatorFeeRecipient,address pairToken,uint256 graduationThreshold,uint24 poolFee,int24 tickSpacing,uint16 creatorTaxBps,bool buybackEnabled,uint8 phase,uint256 sweptQuote,uint256 sweptTokens,uint256 sweptAt,bool exists))",
]);
const curveAbi = parseAbi([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function graduated() view returns (bool)",
]);
const pmAbi = parseAbi(["function extsload(bytes32 slot) view returns (bytes32)"]);
const erc20Abi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);
const LAUNCHED = parseAbiItem(
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
);
const GRADUATED = parseAbiItem(
  "event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)",
);

/* --------------------------------- caching -------------------------------- */

const cache = new Map<string, { at: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
/** Fresh within ttl; past it, the stale value is served while a refresh runs. */
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const run = () => {
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fn()
        .then((v) => {
          cache.set(key, { at: Date.now(), v });
          return v;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  };
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  if (hit) {
    run().catch(() => {});
    return hit.v as T;
  }
  return run();
}

/* ---------------------------------- logs ---------------------------------- */

async function scan<E extends typeof LAUNCHED | typeof GRADUATED>(event: E, span: bigint) {
  const latest = await logs.getBlockNumber();
  const out: { token: Hex; curve?: Hex; pairToken?: Hex; block: bigint }[] = [];
  const STEP = 2_000_000n;
  const floor = latest > span ? latest - span : 0n;
  for (let to = latest; to > floor; to -= STEP) {
    const from = to - STEP + 1n > floor ? to - STEP + 1n : floor;
    try {
      const l = await logs.getLogs({ address: PONS.factory, event, fromBlock: from, toBlock: to, strict: true } as never);
      for (const x of l as unknown as { args: { token: Hex; curve?: Hex; pairToken?: Hex }; blockNumber: bigint }[])
        out.push({ ...x.args, block: x.blockNumber });
    } catch {
      // A refused chunk leaves a gap rather than failing the whole page.
    }
  }
  return out;
}

/* ---------------------------------- ETH/USD ------------------------------- */

const ETH_USDG_POOLS: Hex[] = [
  "0x54f7883914619af9105355bf83ed678bcf9f63560218ac61c9963b9503d0ba32",
  "0x24107d152f14a76d292123265ae3f3c71f863fc2f4ef7ba49d64e78d28ea379e",
];

const b32 = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;

async function readPool(id: Hex) {
  const base = BigInt(keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [id, 6n])));
  const [s0, liq] = await Promise.all([
    reads.readContract({ address: V4.poolManager, abi: pmAbi, functionName: "extsload", args: [b32(base)] }),
    reads.readContract({ address: V4.poolManager, abi: pmAbi, functionName: "extsload", args: [b32(base + 3n)] }),
  ]);
  return { sqrtPriceX96: BigInt(s0) & ((1n << 160n) - 1n), liquidity: BigInt(liq) & ((1n << 128n) - 1n) };
}

export const ethUsd = () =>
  cached("ethusd", 30_000, async () => {
    const pools = await Promise.all(ETH_USDG_POOLS.map((p) => readPool(p).catch(() => null)));
    const prices = pools
      .filter((p): p is NonNullable<typeof p> => !!p && p.liquidity > 0n && p.sqrtPriceX96 > 0n)
      .map((p) => (Number(p.sqrtPriceX96) / 2 ** 96) ** 2 * 1e12);
    if (!prices.length) return null;
    const p = prices[0];
    if (prices[1] && Math.abs(p - prices[1]) / Math.min(p, prices[1]) > 0.015) return null;
    return p > 100 && p < 100_000 ? p : null;
  });

/* --------------------------------- DexScreener ---------------------------- */

type DexPair = {
  pairAddress: string;
  dexId: string;
  labels?: string[];
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceNative?: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
};

async function dexTokens(addrs: string[]): Promise<DexPair[]> {
  const out: DexPair[] = [];
  for (let i = 0; i < addrs.length; i += 30) {
    const chunk = addrs.slice(i, i + 30).join(",");
    try {
      const r = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${chunk}`, { cache: "no-store" });
      if (r.ok) out.push(...((await r.json()) as DexPair[]));
    } catch {}
  }
  return out;
}

/* ---------------------------------- coins --------------------------------- */

export type Coin = {
  address: Hex;
  name: string;
  symbol: string;
  image?: string;
  stage: "curve" | "pool";
  priceUsd: number | null;
  priceEth: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidityUsd: number | null;
  mcapUsd: number | null;
  supply: number;
  venues: Venue[];
  dexUrl?: string;
};

const WEEK_BLOCKS = 2_100_000n * 3n; // ~7 days at ~0.29 s a block
const ALL_TIME = 120_000_000n;

export const launches = () =>
  cached("launches", 15 * 60_000, async () => {
    const [recent, graduated] = await Promise.all([scan(LAUNCHED, WEEK_BLOCKS), scan(GRADUATED, ALL_TIME)]);
    return { recent: recent.filter((l) => !l.pairToken || l.pairToken === ZERO), graduated: graduated.map((g) => g.token) };
  });

async function venuesOf(token: Hex, dex: DexPair[], eth: number | null): Promise<{ venues: Venue[]; stage: Coin["stage"] } | null> {
  const l = await reads.readContract({ address: PONS.factory, abi: factoryAbi, functionName: "getLaunchedToken", args: [token] });
  if (!l.exists || l.pairToken !== ZERO) return null;
  const venues: Venue[] = [];
  const c = { address: l.curve, abi: curveAbi } as const;
  const grad = await reads.readContract({ ...c, functionName: "graduated" }).catch(() => l.phase >= 2);
  let ponsPoolId: string | null = null;
  if (!grad) {
    const [[q, t], fee, tax] = await Promise.all([
      reads.readContract({ ...c, functionName: "getReserves" }),
      reads.readContract({ ...c, functionName: "feeBps" }),
      reads.readContract({ ...c, functionName: "creatorTaxBps" }),
    ]);
    venues.push({
      id: l.curve,
      label: "Pons bonding curve",
      kind: "curve",
      exact: true,
      tokens: Number(t) / 1e18,
      eth: Number(q) / 1e18,
      feeIn: 0,
      feeOut: Number(fee + tax) / 10_000,
    });
  } else {
    const key = {
      currency0: ZERO as Hex,
      currency1: token,
      fee: l.poolFee,
      tickSpacing: l.tickSpacing,
      hooks: PONS.memeHook as Hex,
    };
    ponsPoolId = poolIdOf(key.currency1, key.fee, key.tickSpacing);
    const p = await readPool(ponsPoolId as Hex);
    if (p.liquidity > 0n && p.sqrtPriceX96 > 0n) {
      const s = Number(p.sqrtPriceX96) / 2 ** 96; // sqrt(token per ETH)
      const L = Number(p.liquidity);
      venues.push({
        id: ponsPoolId,
        label: l.poolFee & 0x800000 ? "Pons pool · Uniswap v4 (hook fee not counted)" : "Pons pool · Uniswap v4",
        kind: "v4",
        exact: true,
        eth: L / s / 1e18,
        tokens: (L * s) / 1e18,
        feeIn: (l.poolFee & 0x7fffff) / 1_000_000,
        feeOut: 0,
      });
    }
  }
  // Every other pool DexScreener knows, as constant product on half its USD value a side.
  for (const d of dex) {
    if (d.baseToken.address.toLowerCase() !== token.toLowerCase()) continue;
    if (ponsPoolId && d.pairAddress.toLowerCase() === ponsPoolId.toLowerCase()) continue;
    const liq = d.liquidity?.usd ?? 0;
    const price = Number(d.priceUsd ?? 0);
    if (!eth || !(liq > 0) || !(price > 0)) continue;
    venues.push({
      id: d.pairAddress,
      label: `${d.dexId === "uniswap" ? "Uniswap" : d.dexId} ${d.labels?.[0] ?? ""} · ${d.quoteToken.symbol}`.trim(),
      kind: "pool",
      exact: false,
      tokens: liq / 2 / price,
      eth: liq / 2 / eth,
      feeIn: 0.003,
      feeOut: 0,
    });
  }
  return { venues, stage: grad ? "pool" : "curve" };
}

async function buildCoin(token: Hex, dex: DexPair[], eth: number | null): Promise<Coin | null> {
  const v = await venuesOf(token, dex, eth).catch(() => null);
  if (!v) return null;
  const mine = dex.filter((d) => d.baseToken.address.toLowerCase() === token.toLowerCase());
  const top = mine.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const [supply, sym, name] = await Promise.all([
    reads.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" }),
    top ? top.baseToken.symbol : reads.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }).catch(() => "?"),
    top ? top.baseToken.name : reads.readContract({ address: token, abi: erc20Abi, functionName: "name" }).catch(() => ""),
  ]);
  const deepest = v.venues.filter((x) => x.exact).sort((a, b) => b.eth - a.eth)[0] ?? v.venues[0];
  const priceEth = deepest ? deepest.eth / deepest.tokens : null;
  const priceUsd = top?.priceUsd ? Number(top.priceUsd) : priceEth && eth ? priceEth * eth : null;
  const s = Number(supply) / 1e18;
  const poolEth = v.venues.reduce((a, x) => a + x.eth, 0);
  return {
    address: token,
    name,
    symbol: sym,
    image: top?.info?.imageUrl,
    stage: v.stage,
    priceUsd,
    priceEth,
    change24h: top?.priceChange?.h24 ?? null,
    volume24h: mine.reduce((a, d) => a + (d.volume?.h24 ?? 0), 0) || null,
    liquidityUsd: eth ? poolEth * 2 * eth : null,
    mcapUsd: priceUsd ? priceUsd * s : null,
    supply: s,
    venues: v.venues,
    dexUrl: top?.url,
  };
}

const poolIdOf = (token: Hex, fee: number, tickSpacing: number) =>
  keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }],
      [ZERO, token, fee, tickSpacing, PONS.memeHook as Hex],
    ),
  );

/** Graduated ETH-paired coins ranked by the ETH in their Pons v4 pool, read in multicalls. */
const deepestGraduated = (tokens: Hex[], n: number) =>
  cached(`deepest:${tokens.length}`, 10 * 60_000, async () => {
    const ls = await Promise.all(
      tokens.map((t) =>
        reads.readContract({ address: PONS.factory, abi: factoryAbi, functionName: "getLaunchedToken", args: [t] }).catch(() => null),
      ),
    );
    const eth = await Promise.all(
      ls.map(async (l) => {
        if (!l || !l.exists || l.pairToken !== ZERO) return 0;
        const p = await readPool(poolIdOf(l.token, l.poolFee, l.tickSpacing)).catch(() => null);
        if (!p || p.sqrtPriceX96 === 0n) return 0;
        return Number(p.liquidity) / (Number(p.sqrtPriceX96) / 2 ** 96) / 1e18;
      }),
    );
    return tokens
      .map((t, i) => ({ t, e: eth[i] }))
      .filter((x) => x.e > 0.05)
      .sort((a, b) => b.e - a.e)
      .slice(0, n)
      .map((x) => x.t);
  });

/** The coins worth a desk: deepest first. */
export const markets = () =>
  cached("markets", 60_000, async () => {
    const [l, eth] = await Promise.all([launches(), ethUsd()]);
    // Rank last week's curve coins by real ETH on the curve.
    const recent = l.recent.filter((r) => r.curve);
    const real = await Promise.all(
      recent.map((r) =>
        reads.readContract({ address: r.curve!, abi: curveAbi, functionName: "realQuoteReserve" }).catch(() => 0n),
      ),
    );
    const topCurve = recent
      .map((r, i) => ({ token: r.token, real: real[i] }))
      .filter((x) => x.real > 10n ** 17n)
      .sort((a, b) => (b.real > a.real ? 1 : -1))
      .slice(0, 40)
      .map((x) => x.token);
    const topPools = await deepestGraduated([...new Set(l.graduated)], 60);
    const tokens = [...new Set([...topPools, ...topCurve])];
    const dex = await dexTokens(tokens);
    const coins = (await Promise.all(tokens.map((t) => buildCoin(t, dex, eth)))).filter((c): c is Coin => !!c);
    coins.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0));
    return { coins, ethUsd: eth, readAt: Date.now(), scanned: { recent: l.recent.length, graduated: l.graduated.length } };
  });

export async function coin(token: Hex) {
  const [eth, dex] = await Promise.all([ethUsd(), dexTokens([token])]);
  const c = await buildCoin(token, dex, eth);
  return { coin: c, ethUsd: eth, readAt: Date.now(), pools: dex.filter((d) => d.baseToken.address.toLowerCase() === token.toLowerCase()) };
}

/** Biggest holders, from Blockscout. */
export async function holders(token: Hex) {
  return cached(`holders:${token}`, 5 * 60_000, async () => {
    const r = await fetch(`${MAINNET.explorer}/api/v2/tokens/${token}/holders`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as {
      items: { address: { hash: string; is_contract: boolean; name?: string | null }; value: string }[];
    };
    return j.items.slice(0, 25).map((h) => ({
      address: h.address.hash,
      contract: h.address.is_contract,
      name: h.address.name ?? null,
      amount: Number(BigInt(h.value) / 10n ** 12n) / 1e6,
    }));
  });
}
