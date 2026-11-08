"use client";

import type { SolCoin } from "@/lib/sol/market";

/** Logo, ticker and name of a coin; the mint when DEX Screener does not know it. */
export function CoinTag({ coin, mint }: { coin?: SolCoin | null; mint: string }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {coin?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coin.image} alt="" width={22} height={22} className="rounded-full shrink-0" />
      ) : (
        <span className="w-[22px] h-[22px] rounded-full bg-panel shrink-0" />
      )}
      <span className="font-semibold">{coin ? `$${coin.symbol}` : `${mint.slice(0, 4)}…${mint.slice(-4)}`}</span>
      {coin && <span className="text-dim truncate">{coin.name}</span>}
    </span>
  );
}
