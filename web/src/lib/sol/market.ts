// Solana coins from DEX Screener: the deepest SOL pair of each, and what a sale into it would do.
// The pool is modelled as constant product on DEX Screener's reported reserves, so the numbers are an estimate.

export type SolCoin = {
  mint: string;
  symbol: string;
  name: string;
  image: string | null;
  dex: string;
  priceUsd: number;
  priceSol: number;
  mcap: number | null;
  liqUsd: number;
  vol24: number;
  change24: number | null;
  /** pool reserves: tokens and SOL */
  base: number;
  quote: number;
};

type Pair = {
  chainId: string;
  dexId: string;
  priceUsd?: string;
  priceNative?: string;
  marketCap?: number;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { symbol: string };
  info?: { imageUrl?: string };
};

const API = "https://api.dexscreener.com";

export function toCoin(pairs: Pair[], mint: string): SolCoin | null {
  const p = pairs
    .filter((x) => x.chainId === "solana" && x.baseToken.address === mint && x.quoteToken.symbol === "SOL" && (x.liquidity?.quote ?? 0) > 0)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  if (!p) return null;
  return {
    mint,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    image: p.info?.imageUrl ?? null,
    dex: p.dexId,
    priceUsd: Number(p.priceUsd ?? 0),
    priceSol: Number(p.priceNative ?? 0),
    mcap: p.marketCap ?? null,
    liqUsd: p.liquidity?.usd ?? 0,
    vol24: p.volume?.h24 ?? 0,
    change24: p.priceChange?.h24 ?? null,
    base: p.liquidity?.base ?? 0,
    quote: p.liquidity?.quote ?? 0,
  };
}

export async function coins(mints: string[]): Promise<SolCoin[]> {
  const out: SolCoin[] = [];
  for (let i = 0; i < mints.length; i += 30) {
    const chunk = mints.slice(i, i + 30);
    const r = await fetch(`${API}/tokens/v1/solana/${chunk.join(",")}`, { next: { revalidate: 30 } });
    if (!r.ok) continue;
    const pairs = (await r.json()) as Pair[];
    for (const m of chunk) {
      const c = toCoin(pairs, m);
      if (c) out.push(c);
    }
  }
  return out;
}

/** What the coins people are watching right now: DEX Screener's top boosted and latest profiled Solana tokens. */
export async function trending(): Promise<SolCoin[]> {
  const lists = await Promise.all(
    ["/token-boosts/top/v1", "/token-boosts/latest/v1", "/token-profiles/latest/v1"].map((p) =>
      fetch(API + p, { next: { revalidate: 60 } }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ),
  );
  const mints = [...new Set((lists.flat() as { chainId: string; tokenAddress: string }[]).filter((x) => x.chainId === "solana").map((x) => x.tokenAddress))].slice(0, 60);
  return (await coins(mints)).filter((c) => c.liqUsd >= 5_000).sort((a, b) => b.vol24 - a.vol24);
}

/** Selling `usd` worth into the pool: SOL out after a 0.25% pool fee, and the price move it leaves on the chart. */
export function sellImpact(c: SolCoin, usd: number) {
  if (!c.base || !c.quote || !c.priceUsd) return null;
  const x = usd / c.priceUsd;
  const solOut = ((c.quote * x) / (c.base + x)) * (1 - 0.0025);
  const chart = (c.base / (c.base + x)) ** 2 - 1;
  const fair = x * c.priceSol;
  return { tokens: x, solOut, chart, lostSol: fair - solOut, lostPct: fair ? 1 - solOut / fair : 0 };
}
