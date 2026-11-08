"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { sellImpact } from "@/lib/impact";
import { eth, pct, usd, utc } from "@/lib/format";
import type { Coin } from "@/lib/useMarkets";

const SIZES = [1_000, 5_000, 10_000, 50_000];

export function Simulator({ coin, ethUsd, readAt }: { coin?: Coin; ethUsd: number | null; readAt?: number }) {
  const [size, setSize] = useState(5_000);
  const r = useMemo(() => {
    if (!coin || !coin.priceUsd || !ethUsd) return null;
    return sellImpact(coin.venues, size / coin.priceUsd);
  }, [coin, size, ethUsd]);
  const exact = coin?.venues.every((v) => v.exact);
  const fall = r ? r.chartMove : 0;

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">What a pool sale would do</h2>
          <p className="text-sm text-dim mt-1 max-w-lg">
            Pick a coin below and a size. Sold into the pools, the bag moves the chart. Sold on the desk, the chart
            does not see it.
          </p>
        </div>
        {coin && (
          <div className="text-right">
            <div className="font-semibold">{coin.symbol}</div>
            <div className="text-sm text-dim num">{usd(coin.liquidityUsd)} in pools</div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 mt-5">
        <div>
          <label className="label" htmlFor="size">
            Size of the sale, USD
          </label>
          <input
            id="size"
            className="input num mt-2"
            inputMode="numeric"
            value={size.toLocaleString("en-US")}
            onChange={(e) => setSize(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
          />
          <div className="grid grid-cols-4 gap-2 mt-2">
            {SIZES.map((s) => (
              <button
                key={s}
                className={`btn btn-o h-9 text-sm ${size === s ? "border-accent! text-accent" : ""}`}
                onClick={() => setSize(s)}
              >
                {usd(s, 0)}
              </button>
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-px bg-line mt-5 rounded-xl overflow-hidden border border-line">
            <Stat k="Chart falls" v={r ? pct(r.chartMove) : "–"} tone="down" />
            <Stat k="Pools pay you" v={r && ethUsd ? usd(r.ethOut * ethUsd, 0) : "–"} sub={r ? eth(r.ethOut) : undefined} />
            <Stat k="Lost to slippage and fees" v={r && ethUsd ? usd((r.spotEth - r.ethOut) * ethUsd, 0) : "–"} sub={r ? pct(-r.slippage) : undefined} tone="down" />
            <Stat k="Chart on Kerb" v="0.0%" tone="up" />
          </dl>
          <Link
            href={coin ? `/offers/new?side=ask&token=${coin.address}` : "/offers/new"}
            className="btn btn-a w-full mt-5"
          >
            {coin ? `Post a sell offer for ${coin.symbol}` : "Post a sell offer"}
          </Link>
        </div>

        <div className="flex flex-col">
          <Bars fall={fall} />
          <p className="text-xs text-dim mt-3">
            {coin
              ? `${coin.venues.length} venue${coin.venues.length === 1 ? "" : "s"} read ${readAt ? utc(readAt) : ""}. ${exact ? "All read on chain." : "Pools not launched on pump.fun are modelled from DexScreener liquidity, so treat them as an estimate."} `
              : "Loading the pools… "}
            {coin && (
              <Link className="link" href={`/pools?token=${coin.address}`}>
                Pool check
              </Link>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v, sub, tone }: { k: string; v: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="bg-panel p-4">
      <dt className="label">{k}</dt>
      <dd className={`text-2xl font-bold num mt-1 ${tone === "down" ? "text-down" : tone === "up" ? "text-up" : ""}`}>{v}</dd>
      {sub && <dd className="text-xs text-dim num mt-0.5">{sub}</dd>}
    </div>
  );
}

/** Price path: flat for the desk, a step down for the pools. */
function Bars({ fall }: { fall: number }) {
  const depth = Math.min(Math.abs(fall), 0.6);
  const H = 220;
  const top = 40;
  const drop = top + (depth / 0.6) * (H - top - 30);
  return (
    <svg viewBox={`0 0 400 ${H}`} className="w-full flex-1 min-h-[200px] rounded-xl border border-line bg-ink" role="img" aria-label="Price after the sale">
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1="0" x2="400" y1={top + i * 50} y2={top + i * 50} stroke="#2a2c22" />
      ))}
      <path d={`M0 ${top} H200 V${drop} H400`} stroke="#ff6b57" strokeWidth="3" fill="none" />
      <path d={`M0 ${top} H400`} stroke="#f2c230" strokeWidth="3" fill="none" />
      <rect x="196" y="0" width="8" height={H} fill="#f1efe4" opacity="0.06" />
      <text x="10" y={top - 12} fill="#f2c230" fontSize="12" fontWeight="600" fontFamily="Inter">
        KERB 0.0%
      </text>
      <text x="390" y={Math.min(drop + 20, H - 8)} textAnchor="end" fill="#ff6b57" fontSize="12" fontWeight="600" fontFamily="Inter">
        POOLS {pct(fall)}
      </text>
      <text x="206" y={H - 10} fill="#9b9a8c" fontSize="11" fontFamily="Inter">
        THE SALE
      </text>
    </svg>
  );
}
