"use client";

import Link from "next/link";
import { useState } from "react";
import { OfferTable } from "@/components/OfferRow";
import { live, useOffers } from "@/lib/desk";
import { ZERO } from "@/lib/chain";

export default function Offers() {
  const q = useOffers();
  const [tab, setTab] = useState<"all" | "ask" | "bid">("all");
  const open = (q.data ?? []).filter((o) => live(o) && o.taker === ZERO && (tab === "all" || o.side === tab)).reverse();
  return (
    <div className="wrap py-8 space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Offers</h1>
          <p className="text-dim mt-1">The public book. Private offers only show to the wallet they name, on its Positions page.</p>
        </div>
        <div className="seg ml-auto">
          {(["all", "ask", "bid"] as const).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "all" ? "All" : t === "ask" ? "Asks" : "Bids"}
            </button>
          ))}
        </div>
      </div>
      <section className="card">
        {q.isLoading ? (
          <p className="p-6 text-dim">Reading the desk…</p>
        ) : (
          <OfferTable offers={open} empty={<>No open offers. <Link className="link" href="/offers/new">Post one</Link></>} />
        )}
      </section>
    </div>
  );
}
