"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sellImpact } from "@/lib/sol/market";
import { useSolMarkets } from "@/lib/sol/useCoin";
import { pct, usd } from "@/lib/format";

/** Pool vs Kerb as two trade tickets, on a real coin people are trading now. Cycles through the worst hit ones. */
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
  const pts = Array.from({ length: 30 }, (_, k) => `${k * 10},${26 + Math.sin(k * 0.9) * 4 + (k > 19 ? (k - 19) * 6 * drop : 0)}`);
  return (
    <div key={c.mint} className="rise mt-12 w-full max-w-3xl grid sm:grid-cols-2 gap-px bg-line text-left border border-line">
      <div className="ticket bad">
        <div className="tk-h"><span>Pool · sell $10K of ${c.symbol}</span><span>market order</span></div>
        <svg viewBox="0 0 290 90" preserveAspectRatio="none" className="w-full h-20 block">
          <polyline points={pts.join(" ")} fill="none" stroke="#ff6b57" strokeWidth="2.5" />
          <polygon points={`0,90 ${pts.join(" ")} 290,90`} fill="rgba(255,107,87,.08)" />
        </svg>
        <div className="px-4 pb-4">
          <div className="tk-n text-down">{pct(r!.chart)}</div>
          <div className="num text-xs text-dim mt-2">≈ {usd(r!.lostPct * 10_000)} lost on the way out</div>
        </div>
      </div>
      <Link href={`/deal/new?token=${c.mint}`} className="ticket good group">
        <div className="tk-h"><span>Kerb · same bag, one buyer</span><span className="group-hover:underline">sell it ↗</span></div>
        <svg viewBox="0 0 290 90" preserveAspectRatio="none" className="w-full h-20 block">
          <path d="M0 30H290" stroke="#f2c230" strokeWidth="2.5" />
        </svg>
        <div className="px-4 pb-6">
          <div className="tk-n text-up">0.0%</div>
          <div className="num text-xs text-dim mt-2">one transaction · the chart never sees it</div>
        </div>
      </Link>
    </div>
  );
}
