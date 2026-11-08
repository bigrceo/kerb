"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CoinTag } from "@/components/CoinTag";
import { sellImpact } from "@/lib/sol/market";
import { useSolMarkets } from "@/lib/sol/useCoin";
import { pct, usd, utc } from "@/lib/format";

const SIZES = [1_000, 5_000, 10_000, 50_000];

export default function Markets() {
  const m = useSolMarkets();
  const [size, setSize] = useState(10_000);
  const rows = useMemo(() => (m.data?.coins ?? []).map((c) => ({ c, r: sellImpact(c, size) })), [m.data, size]);
  return (
    <div className="wrap py-8 space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Markets</h1>
          <p className="text-dim mt-1 max-w-2xl">What selling a bag into the pool does to the chart, for the Solana coins people are trading right now. On Kerb the same bag moves the chart 0.0%.</p>
        </div>
        <div className="ml-auto">
          <div className="label mb-2">Size of the sale</div>
          <div className="seg">
            {SIZES.map((s) => (
              <button key={s} aria-pressed={size === s} onClick={() => setSize(s)}>{usd(s)}</button>
            ))}
          </div>
        </div>
      </div>
      <section className="card overflow-x-auto">
        {m.isLoading ? (
          <p className="p-6 text-dim">Reading Solana pools…</p>
        ) : !rows.length ? (
          <p className="p-6 text-dim">No data right now. Try again in a minute.</p>
        ) : (
          <table className="t min-w-[760px]">
            <thead>
              <tr>{["Coin", "Price", "Mcap", "Liquidity", "24h", `Sell ${usd(size)} in the pool`, "Lost on the way out", ""].map((h) => <th key={h} className="label">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(({ c, r }) => (
                <tr key={c.mint}>
                  <td><CoinTag coin={c} mint={c.mint} /></td>
                  <td className="num">{usd(c.priceUsd)}</td>
                  <td className="num">{usd(c.mcap)}</td>
                  <td className="num">{usd(c.liqUsd)}</td>
                  <td className={`num ${(c.change24 ?? 0) >= 0 ? "text-up" : "text-down"}`}>{pct((c.change24 ?? 0) / 100)}</td>
                  <td className="num text-down font-semibold">{r ? `chart ${pct(r.chart)}` : "–"}</td>
                  <td className="num text-dim">{r ? usd(r.lostPct * size) : "–"}</td>
                  <td className="text-right">
                    <Link href={`/deal/new?token=${c.mint}`} className="btn btn-o h-8 text-xs">Sell on Kerb</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="text-xs text-dim">
        {m.data ? `Read ${utc(m.data.readAt)}. ` : ""}Coins and pool reserves from DEX Screener; the sale is modelled as constant product on the deepest SOL pool with a 0.25% pool fee. An estimate, not a quote.
      </p>
    </div>
  );
}
