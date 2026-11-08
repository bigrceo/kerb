"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { decodeEventLog, isAddress, parseEther, parseUnits } from "viem";
import { CoinPicker } from "@/components/CoinPicker";
import { Connect } from "@/components/Header";
import { deskAbi, erc20, useTx } from "@/lib/desk";
import { useCoin } from "@/lib/useMarkets";
import { buyCost, sellImpact } from "@/lib/impact";
import { DEMO_COIN, DESK, FEE_BPS, ON_TESTNET, ZERO, deskTx } from "@/lib/chain";
import { eth, pct, usd } from "@/lib/format";

const DURATIONS = [
  ["1 hour", 3600],
  ["1 day", 86400],
  ["3 days", 3 * 86400],
  ["7 days", 7 * 86400],
] as const;

function Ticket() {
  const sp = useSearchParams();
  const { address } = useAccount();
  const client = usePublicClient();
  const [side, setSide] = useState<"ask" | "bid">(sp.get("side") === "bid" ? "bid" : "ask");
  const [token, setToken] = useState(sp.get("token") ?? (ON_TESTNET ? DEMO_COIN : ""));
  const [qty, setQty] = useState("");
  const [total, setTotal] = useState("");
  const [partial, setPartial] = useState(false);
  const [minFill, setMinFill] = useState("");
  const [taker, setTaker] = useState(sp.get("taker") ?? "");
  const [dur, setDur] = useState<number>(86400);
  const [posted, setPosted] = useState<number>();
  const tx = useTx();
  const approveTx = useTx();
  const valid = isAddress(token);

  // The coin on the desk's chain.
  const meta = useQuery({
    queryKey: ["meta", token, address],
    enabled: valid && !!client,
    queryFn: async () => {
      const code = await client!.getCode({ address: token as `0x${string}` });
      if (!code) return null;
      const [symbol, decimals, bal, allow] = await Promise.all([
        client!.readContract({ address: token as `0x${string}`, abi: erc20, functionName: "symbol" }),
        client!.readContract({ address: token as `0x${string}`, abi: erc20, functionName: "decimals" }),
        address ? client!.readContract({ address: token as `0x${string}`, abi: erc20, functionName: "balanceOf", args: [address] }) : 0n,
        address ? client!.readContract({ address: token as `0x${string}`, abi: erc20, functionName: "allowance", args: [address, DESK] }) : 0n,
      ]);
      return { symbol, decimals: Number(decimals), bal, allow };
    },
  });
  // The coin on mainnet, for the pool comparison.
  const market = useCoin(valid ? token : undefined).data;
  const c = market?.coin;
  const ethUsd = market?.ethUsd ?? null;

  const q = Number(qty) || 0;
  // Until edited, the total follows the market price.
  const totalStr = total !== "" ? total : c?.priceEth && q ? Number((q * c.priceEth).toPrecision(4)).toString() : "";
  const t = Number(totalStr) || 0;
  const pool = useMemo(() => {
    if (!c || !q) return null;
    if (side === "ask") {
      const r = sellImpact(c.venues, q);
      return r && { label: "Selling the same bag into the pools pays", eth: r.ethOut, chart: r.chartMove, better: r.ethOut > t };
    }
    const cost = buyCost(c.venues, q);
    return cost != null ? { label: "Buying the same bag from the pools costs", eth: cost, chart: null, better: cost < t } : null;
  }, [c, q, t, side]);

  const d = meta.data?.decimals ?? 18;
  const amt = q ? parseUnits(qty, d) : 0n;
  const wei = t ? parseEther(totalStr) : 0n;
  const min = partial && Number(minFill) > 0 ? parseUnits(minFill, d) : amt;
  const needApprove = side === "ask" && meta.data && meta.data.allow < amt;
  const short = side === "ask" && meta.data && meta.data.bal < amt;
  const badTaker = taker !== "" && !isAddress(taker);
  const ready = meta.data && amt > 0n && wei > 0n && min > 0n && min <= amt && !badTaker && !short;

  async function post() {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + dur);
    const to = (taker || ZERO) as `0x${string}`;
    const hash =
      side === "ask"
        ? await tx.send({ address: DESK, abi: deskAbi, functionName: "postAsk", args: [token, amt, wei, min, to, expiry] }, "Offer posted")
        : await tx.send({ address: DESK, abi: deskAbi, functionName: "postBid", args: [token, amt, min, to, expiry], value: wei }, "Offer posted");
    if (!hash) return;
    const r = await client!.getTransactionReceipt({ hash });
    for (const l of r.logs) {
      try {
        const e = decodeEventLog({ abi: deskAbi, data: l.data, topics: l.topics }) as unknown as { eventName: string; args: { id: bigint } };
        if (e.eventName === "OfferPosted") setPosted(Number(e.args.id));
      } catch {}
    }
  }

  return (
    <div className="wrap py-8 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <section className="card p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Make an offer</h1>
          <div className="seg ml-auto">
            <button aria-pressed={side === "ask"} onClick={() => setSide("ask")}>Sell a bag</button>
            <button aria-pressed={side === "bid"} onClick={() => setSide("bid")}>Bid for a bag</button>
          </div>
        </div>

        <div>
          <div className="label mb-2">Coin</div>
          <CoinPicker value={token} onChange={setToken} extra={ON_TESTNET ? [{ address: DEMO_COIN, symbol: "KDEMO (testnet)" }] : []} />
          {valid && meta.isFetched && !meta.data && (
            <p className="text-sm text-down mt-2">
              This coin does not exist on {ON_TESTNET ? "the testnet desk" : "this chain"}.{" "}
              {ON_TESTNET && <>The pool comparison below still reads mainnet; to try a real fill, use the KDEMO testnet coin.</>}
            </p>
          )}
          {meta.data && address && (
            <p className="text-xs text-dim mt-2 num">You hold {(Number(meta.data.bal) / 10 ** d).toLocaleString("en-US")} {meta.data.symbol}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="qty">Tokens {side === "ask" ? "to sell" : "to buy"}</label>
            <input id="qty" className="input num mt-2" inputMode="decimal" value={qty} onChange={(e) => { setQty(e.target.value.replace(/[^0-9.]/g, "")); setTotal(""); }} />
            {side === "ask" && meta.data && (
              <button className="text-xs link mt-1" onClick={() => { setQty(String(Number(meta.data!.bal) / 10 ** d)); setTotal(""); }}>Whole bag</button>
            )}
          </div>
          <div>
            <label className="label" htmlFor="total">Total, SOL</label>
            <input id="total" className="input num mt-2" inputMode="decimal" value={totalStr} onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))} />
            <p className="text-xs text-dim mt-1 num">
              {t && q ? `${(t / q).toPrecision(4)} SOL per token` : "Starts at the market price"}
              {c?.priceEth && t && q ? `, ${pct(t / q / c.priceEth - 1)} vs market` : ""}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="label">Stands for</div>
            <div className="seg mt-2 w-full grid! grid-cols-4">
              {DURATIONS.map(([l, s]) => (
                <button key={s} className="flex-1" aria-pressed={dur === s} onClick={() => setDur(s)}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="taker">Only for this wallet (optional)</label>
            <input id="taker" className="input num mt-2" placeholder="Anyone" value={taker} onChange={(e) => setTaker(e.target.value.trim())} />
            {badTaker && <p className="text-xs text-down mt-1">Not an address</p>}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} className="accent-[#f2c230]" />
            Allow partial fills
          </label>
          {partial && (
            <input className="input num mt-2" placeholder="Smallest fill, in tokens" value={minFill} onChange={(e) => setMinFill(e.target.value.replace(/[^0-9.]/g, ""))} />
          )}
        </div>

        <div className="pt-2 flex flex-wrap gap-3">
          {!address ? (
            <Connect />
          ) : needApprove ? (
            <button className="btn btn-a" disabled={approveTx.busy || !ready && !needApprove} onClick={async () => { await approveTx.send({ address: token as `0x${string}`, abi: erc20, functionName: "approve", args: [DESK, amt] }, "Approved"); meta.refetch(); }}>
              {approveTx.busy ? approveTx.msg : `Approve exactly ${q.toLocaleString("en-US")} ${meta.data?.symbol}`}
            </button>
          ) : (
            <button className="btn btn-a" disabled={!ready || tx.busy} onClick={post}>
              {tx.busy ? tx.msg : side === "ask" ? "Lock the bag and post" : `Lock ${totalStr || 0} SOL and post`}
            </button>
          )}
          {short && <p className="text-sm text-down self-center">You do not hold that many.</p>}
          {(tx.msg || approveTx.msg) && !tx.busy && !approveTx.busy && (
            <p className="text-sm self-center">
              {tx.msg ?? approveTx.msg}{" "}
              {tx.hash && <a className="link" href={deskTx(tx.hash)} target="_blank" rel="noreferrer">View tx</a>}{" "}
              {posted != null && <Link className="link" href={`/offers/${posted}`}>Open offer #{posted}</Link>}
            </p>
          )}
        </div>
      </section>

      <aside className="card p-5 space-y-4 lg:sticky lg:top-24 min-w-0">
        <h2 className="font-bold">Before you sign</h2>
        <Row k={side === "ask" ? "You lock" : "You lock"} v={side === "ask" ? `${q.toLocaleString("en-US")} ${meta.data?.symbol ?? ""}` : eth(t, 6)} />
        <Row k={side === "ask" ? "You receive on a full fill" : "You receive on a full fill"} v={side === "ask" ? eth(t, 6) : `${q.toLocaleString("en-US")} ${meta.data?.symbol ?? ""}`} />
        <Row k="Taker pays the fee" v={`${Number(FEE_BPS) / 100}% of the SOL leg`} />
        <Row k="Your fee" v="None" />
        <div className="border-t border-line pt-4">
          <div className="label">Against the pools</div>
          {pool ? (
            <>
              <p className="text-sm mt-2">{pool.label} <span className="num font-semibold">{eth(pool.eth, 5)}</span>{ethUsd ? <span className="text-dim num"> ({usd(pool.eth * ethUsd)})</span> : null}.</p>
              {pool.chart != null && <p className="text-sm mt-1">It would move the chart <span className="text-down num font-semibold">{pct(pool.chart)}</span>. Here: 0.0%.</p>}
              {t > 0 && pool.better && (
                <p className="text-sm mt-2 text-accent">
                  {side === "ask" ? "The pools would pay you more than this price." : "The pools would sell it to you for less."}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-dim mt-2">{valid ? (c === null ? "Not a pump.fun coin with an SOL pool, so no comparison." : "Enter a size to compare.") : "Pick a coin."}</p>
          )}
        </div>
        <p className="text-xs text-dim border-t border-line pt-4">
          Your {side === "ask" ? "tokens" : "SOL"} sit in the desk contract until a fill, a cancel or the expiry. Cancel any time; after expiry anyone can send the escrow back to you, and only to you.
        </p>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-dim">{k}</span>
      <span className="num font-semibold text-right">{v}</span>
    </div>
  );
}

export default function Page() {
  return <Suspense><Ticket /></Suspense>;
}
