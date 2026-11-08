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
  const drop = Math.max(0.35, Math.min(1, -r!.chart * 2.5));
  const pts = Array.from({ length: 30 }, (_, k) => `${k * 10},${24 + Math.sin(k * 0.9) * 4 + (k > 19 ? ((k - 19) / 10) ** 1.6 * 58 * drop : 0)}`);
  const end = pts[pts.length - 1].split(",");
  return (
    <div key={c.mint} className="rise mt-12 w-full max-w-3xl grid sm:grid-cols-2 gap-3 text-left">
      <div className="ticket bad">
        <div className="tk-h"><span>Pool · sell $10K of ${c.symbol}</span><span>market order</span></div>
        <svg viewBox="0 0 290 90" preserveAspectRatio="none" className="w-full h-20 block">
          <polyline points={pts.join(" ")} fill="none" stroke="#ff6b57" strokeWidth="2.5" />
          <defs>
            <linearGradient id="rf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff6b57" stopOpacity=".25" /><stop offset="1" stopColor="#ff6b57" stopOpacity="0" /></linearGradient>
            <linearGradient id="yf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f2c230" stopOpacity=".22" /><stop offset="1" stopColor="#f2c230" stopOpacity="0" /></linearGradient>
          </defs>
          <polygon points={`0,90 ${pts.join(" ")} 290,90`} fill="url(#rf)" />
          <circle cx={end[0]} cy={end[1]} r="3.5" fill="#ff6b57" />
        </svg>
        <div className="px-4 pb-4">
          <div className="tk-n text-down">{pct(r!.chart)}</div>
          <div className="num text-xs text-dim mt-2">≈ {usd(r!.lostPct * 10_000)} lost on the way out</div>
        </div>
      </div>
      <Link href={`/deal/new?token=${c.mint}`} className="ticket good group">
        <div className="tk-h"><span>Kerb · same bag, one buyer</span><span className="group-hover:underline">sell it ↗</span></div>
        <span className="relative block">
          <svg viewBox="0 0 290 90" preserveAspectRatio="none" className="w-full h-20 block">
            <polygon points="0,30 290,30 290,90 0,90" fill="url(#yf)" />
            <path d="M0 30H290" stroke="#f2c230" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="absolute right-3 top-[26.7%] -translate-y-1/2 w-2.5 h-2.5">
            <span className="pulse absolute inset-0 rounded-full bg-accent" />
            <span className="absolute inset-0 rounded-full bg-accent" />
          </span>
        </span>
        <div className="px-4 pb-4">
          <div className="tk-n text-up">0.0%</div>
          <div className="num text-xs text-dim mt-2">one transaction · the chart never sees it</div>
        </div>
      </Link>
    </div>
  );
}
