"use client";

import { useAccount } from "wagmi";
import { OfferTable } from "@/components/OfferRow";
import { Connect } from "@/components/Header";
import { live, useOffers } from "@/lib/desk";

export default function Positions() {
  const { address } = useAccount();
  const q = useOffers();
  const me = address?.toLowerCase();
  const mine = (q.data ?? []).filter((o) => o.maker.toLowerCase() === me).reverse();
  const forMe = (q.data ?? []).filter((o) => o.taker.toLowerCase() === me && live(o));
  const stuck = mine.filter((o) => o.open && !live(o));
  return (
    <div className="wrap py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Positions</h1>
        <p className="text-dim mt-1">Your offers, what is still in escrow, and private offers made to you.</p>
      </div>
      {!address ? (
        <div className="card p-6 flex flex-wrap items-center gap-4">
          <p className="text-dim">Connect a wallet to see its offers.</p>
          <Connect />
        </div>
      ) : (
        <>
          {stuck.length > 0 && (
            <p className="card p-4 text-sm">
              <span className="label text-accent mr-2">Escrow to reclaim</span>
              {stuck.length} expired offer{stuck.length > 1 ? "s" : ""} still hold{stuck.length > 1 ? "" : "s"} your escrow. Open {stuck.length > 1 ? "each" : "it"} and press Reclaim.
            </p>
          )}
          <section className="card">
            <h2 className="p-4 font-bold border-b border-line">Made to you, privately</h2>
            <OfferTable offers={forMe} empty="No private offers name this wallet." />
          </section>
          <section className="card">
            <h2 className="p-4 font-bold border-b border-line">Your offers</h2>
            <OfferTable offers={mine} empty="This wallet has not posted an offer." />
          </section>
        </>
      )}
    </div>
  );
}
