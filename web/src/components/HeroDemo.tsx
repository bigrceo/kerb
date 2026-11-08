"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sellImpact } from "@/lib/sol/market";
import { useSolMarkets } from "@/lib/sol/useCoin";
import { pct, usd } from "@/lib/format";

/** Pool vs Kerb, side by side, on a real coin people are trading now. Cycles through the worst hit ones. */
export function HeroDemo() {
  const m = useSolMarkets();
  const list = (m.data?.coins ?? []).map((c) => ({ c, r: sellImpact(c, 10_000) })).filter((x) => x.r && x.r.chart < -0.03).slice(0, 6);
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 4500);
    return () => clearInterval(id);
  }, []);
  if (!list.length) return null;
  const { c, r } = list[i % list.length];
  const drop = Math.min(1, -r!.chart * 2);
  const pts = Array.from({ length: 24 }, (_, k) => `${k * 12},${30 + Math.sin(k * 0.9) * 4 + (k > 15 ? (k - 15) * 7 * drop : 0)}`).join(" ");
  return (
    <div key={c.mint} className="rise mt-10 w-full max-w-2xl grid sm:grid-cols-2 gap-3 text-left">
      <div className="card p-4">
        <div className="label">Sell $10K of ${c.symbol} into the pool</div>
        <svg viewBox="0 0 276 90" className="w-full h-16 mt-2"><polyline points={pts} fill="none" stroke="#ff6b57" strokeWidth="3" strokeLinejoin="round" /></svg>
        <div className="text-3xl font-extrabold text-down num">{pct(r!.chart)}</div>
        <div className="text-xs text-dim mt-1">about {usd(r!.lostPct * 10_000)} lost on the way out</div>
      </div>
      <Link href={`/deal/new?token=${c.mint}`} className="card p-4 hover:border-accent">
        <div className="label">The same bag on Kerb</div>
        <svg viewBox="0 0 276 90" className="w-full h-16 mt-2"><path d="M0 34H276" stroke="#f2c230" strokeWidth="3" /></svg>
        <div className="text-3xl font-extrabold text-up num">0.0%</div>
        <div className="text-xs text-dim mt-1">one buyer, one transaction · sell it now ↗</div>
      </Link>
    </div>
  );
}
