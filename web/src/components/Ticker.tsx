"use client";

import Link from "next/link";
import { sellImpact } from "@/lib/sol/market";
import { useSolMarkets } from "@/lib/sol/useCoin";
import { pct } from "@/lib/format";

/** A terminal-style tape: what a $10K sale into the pool would do to each coin people are trading right now. */
export function Ticker() {
  const m = useSolMarkets();
  const items = (m.data?.coins ?? [])
    .map((c) => ({ c, r: sellImpact(c, 10_000) }))
    .filter((x) => x.r && x.r.chart < -0.005)
    .slice(0, 16);
  if (!items.length) return null;
  const row = items.map(({ c, r }) => (
    <Link key={c.mint} href={`/deal/new?token=${c.mint}`} className="inline-flex items-center gap-2 px-5 whitespace-nowrap hover:text-fg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.image && <img src={c.image} alt="" width={16} height={16} className="rounded-full" />}
      <span className="text-fg font-semibold">${c.symbol}</span>
      <span>$10K into the pool</span>
      <span className="text-down font-semibold num">{pct(r!.chart)}</span>
      <span className="text-dim">· on Kerb</span>
      <span className="text-up font-semibold num">0.0%</span>
    </Link>
  ));
  return (
    <div className="tape border-y border-line bg-[#0f100b] text-xs text-dim overflow-hidden" aria-label="Pool impact of a $10K sale">
      <div className="tape-in py-2">
        {row}
        {row}
      </div>
    </div>
  );
}
