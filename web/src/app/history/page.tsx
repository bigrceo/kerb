"use client";

import { useFills, useOffers } from "@/lib/desk";
import { amount, eth } from "@/lib/format";
import { deskTx, short } from "@/lib/chain";

export default function History() {
  const f = useFills();
  const o = useOffers();
  const byId = new Map((o.data ?? []).map((x) => [x.id, x]));
  return (
    <div className="wrap py-8 space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">History</h1>
        <p className="text-dim mt-1">Every fill, read from the desk contract&apos;s OfferFilled events. Nothing here comes from a database.</p>
      </div>
      <section className="card overflow-x-auto">
        {f.isLoading ? (
          <p className="p-6 text-dim">Reading fills…</p>
        ) : !f.data?.length ? (
          <p className="p-6 text-dim">No fills yet.</p>
        ) : (
          <table className="t min-w-[640px]">
            <thead>
              <tr>{["Offer", "Side", "Coin", "Tokens", "SOL", "Taker fee", "Taker", "Tx"].map((h) => <th key={h} className="label">{h}</th>)}</tr>
            </thead>
            <tbody>
              {f.data.map((x) => {
                const of = byId.get(x.id);
                return (
                  <tr key={x.tx + x.id}>
                    <td className="num">#{x.id}</td>
                    <td>{of?.side === "ask" ? "Bag sold" : "Bid filled"}</td>
                    <td className="font-semibold">{of?.symbol ?? "?"}</td>
                    <td className="num">{amount(Number(x.tokens) / 10 ** (of?.decimals ?? 18))}</td>
                    <td className="num">{eth(Number(x.eth) / 1e18, 8)}</td>
                    <td className="num text-dim">{eth(Number(x.fee) / 1e18, 8)}</td>
                    <td className="num text-dim">{short(x.taker)}</td>
                    <td><a className="link num" href={deskTx(x.tx)} target="_blank" rel="noreferrer">{short(x.tx)}</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
