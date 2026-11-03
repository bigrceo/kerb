"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CoinPicker } from "@/components/CoinPicker";
import { useCoin } from "@/lib/useMarkets";
import { sellImpact } from "@/lib/impact";
import { eth, pct, price, usd, utc } from "@/lib/format";
import { mainAddr, short } from "@/lib/chain";

const SIZES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

function Pools() {
  const sp = useSearchParams();
  const [token, setToken] = useState(sp.get("token") ?? "");
  const q = useCoin(/^0x[0-9a-fA-F]{40}$/.test(token) ? token : undefined);
  const c = q.data?.coin;
  const ethUsd = q.data?.ethUsd ?? null;
  return (
    <div className="wrap py-8 space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Pool check</h1>
        <p className="text-dim mt-1 max-w-2xl">Every venue a coin trades in, read live, and what selling into all of them at once would cost.</p>
      </div>
      <div className="card p-5"><CoinPicker value={token} onChange={setToken} /></div>
      {q.isFetching && !c && <p className="text-dim">Reading pools on Robinhood Chain…</p>}
      {q.data && !c && <p className="text-dim">That address is not an ETH-paired Pons coin, so there is no pool to read. You can still make an offer for it.</p>}
      {c && (
        <>
          <section className="card p-5">
            <div className="flex flex-wrap gap-6">
              <div><div className="label">Coin</div><div className="text-xl font-bold">{c.symbol}</div><div className="text-xs text-dim">{c.name}</div></div>
              <div><div className="label">Price</div><div className="text-xl font-bold num">{price(c.priceUsd)}</div></div>
              <div><div className="label">In pools</div><div className="text-xl font-bold num">{usd(c.liquidityUsd)}</div></div>
              <div><div className="label">Mkt cap</div><div className="text-xl font-bold num">{usd(c.mcapUsd)}</div></div>
              <div><div className="label">Stage</div><div className="text-xl font-bold">{c.stage === "curve" ? "Bonding curve" : "Graduated"}</div></div>
            </div>
          </section>
          <section className="card overflow-x-auto">
            <h2 className="p-4 font-bold border-b border-line">Venues</h2>
            <table className="t min-w-[600px]">
              <thead><tr>{["Venue", "ETH side", "Token side", "Fee", "Source", "Address"].map((h) => <th key={h} className="label">{h}</th>)}</tr></thead>
              <tbody>
                {c.venues.map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <img src={v.kind === "curve" ? "/brands/pons.jpg" : "/brands/uniswap.png"} alt="" width={18} height={18} className="rounded-full" />
                        {v.label}
                      </span>
                    </td>
                    <td className="num">{eth(v.eth, 3)}</td>
                    <td className="num">{v.tokens.toExponential(3)}</td>
                    <td className="num">{pct(v.feeIn + v.feeOut, 2).replace("+", "")}</td>
                    <td className="text-sm text-dim">{v.exact ? "On chain" : "DEX Screener, estimate"}</td>
                    <td><a className="link num text-sm" href={mainAddr(v.id.length === 42 ? v.id : "")} target="_blank" rel="noreferrer">{short(v.id)}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card overflow-x-auto">
            <h2 className="p-4 font-bold border-b border-line">A sale into the pools, by size</h2>
            <table className="t min-w-[600px]">
              <thead><tr>{["Sale", "Pools pay", "Average fill", "Chart moves", "On Kerb"].map((h) => <th key={h} className="label">{h}</th>)}</tr></thead>
              <tbody>
                {SIZES.map((s) => {
                  const r = c.priceUsd ? sellImpact(c.venues, s / c.priceUsd) : null;
                  return (
                    <tr key={s}>
                      <td className="num font-semibold">{usd(s, 0)}</td>
                      <td className="num">{r && ethUsd ? usd(r.ethOut * ethUsd, 0) : "–"}</td>
                      <td className="num text-down">{r ? pct(-r.slippage) : "–"}</td>
                      <td className="num text-down">{r ? pct(r.chartMove) : "–"}</td>
                      <td className="num text-up">0.0%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="p-4 text-xs text-dim border-t border-line">
              Read {q.data ? utc(q.data.readAt) : ""}. Curve: Pons&apos; own constant-product formula with its fee and creator tax. Graduated pool: full-range Uniswap v4 liquidity, pool fee only (the Pons hook fee is not counted, so real fills are slightly worse).
            </p>
          </section>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Pools /></Suspense>;
}
