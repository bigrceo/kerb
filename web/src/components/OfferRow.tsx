"use client";

import Link from "next/link";
import { left, live, tokens, unitPrice, type Offer } from "@/lib/desk";
import { amount, until } from "@/lib/format";
import { short, ZERO } from "@/lib/chain";

export function status(o: Offer) {
  if (live(o)) return o.filled > 0n ? "Part filled" : "Open";
  if (o.open) return "Expired";
  return o.filled === o.amount ? "Filled" : "Closed";
}

export function OfferTable({ offers, empty }: { offers: Offer[]; empty: React.ReactNode }) {
  if (!offers.length) return <p className="p-6 text-dim">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="t min-w-[680px]">
        <thead>
          <tr>
            {["#", "Side", "Coin", "Left", "Total", "Per token", "To", "Status", ""].map((h) => (
              <th key={h} className="label">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offers.map((o) => (
            <tr key={o.id}>
              <td className="num text-dim">{o.id}</td>
              <td className={o.side === "ask" ? "text-down font-semibold" : "text-up font-semibold"}>{o.side === "ask" ? "Selling" : "Buying"}</td>
              <td className="font-semibold">{o.symbol}</td>
              <td className="num">{amount(tokens(o, left(o)))}</td>
              <td className="num">{(Number(o.total) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })} ETH</td>
              <td className="num text-dim">{unitPrice(o).toPrecision(3)} ETH</td>
              <td className="num text-dim">{o.taker === ZERO ? "Anyone" : short(o.taker)}</td>
              <td className="text-sm">
                {status(o)}
                {live(o) && <span className="block text-xs text-dim">ends in {until(o.expiry * 1000)}</span>}
              </td>
              <td className="text-right">
                <Link href={`/offers/${o.id}`} className="btn btn-o h-8 text-xs">
                  {live(o) ? "Take" : "View"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
