"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CoinPicker } from "@/components/CoinPicker";
import { useCoin } from "@/lib/useMarkets";
import { amount, usd } from "@/lib/format";
import { mainAddr, short } from "@/lib/chain";

type H = { address: string; contract: boolean; name: string | null; amount: number };

function Wallets() {
  const sp = useSearchParams();
  const [token, setToken] = useState(sp.get("token") ?? "");
  const ok = /^0x[0-9a-fA-F]{40}$/.test(token);
  const h = useQuery<{ holders: H[] }>({ queryKey: ["holders", token], enabled: ok, queryFn: () => fetch(`/api/holders/${token}`).then((r) => r.json()) });
  const c = useCoin(ok ? token : undefined).data?.coin;
  return (
    <div className="wrap py-8 space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Wallets</h1>
        <p className="text-dim mt-1 max-w-2xl">The biggest holders of a coin, from Solscan. Want a bag that is not for sale? Make its holder a private offer.</p>
      </div>
      <div className="card p-5"><CoinPicker value={token} onChange={setToken} /></div>
      {ok && (
        <section className="card overflow-x-auto">
          {h.isLoading ? <p className="p-6 text-dim">Reading holders…</p> : !h.data?.holders.length ? <p className="p-6 text-dim">No holders found.</p> : (
            <table className="t min-w-[560px]">
              <thead><tr>{["#", "Wallet", "Holds", "Share", "Worth", ""].map((x) => <th key={x} className="label">{x}</th>)}</tr></thead>
              <tbody>
                {h.data.holders.map((x, i) => (
                  <tr key={x.address}>
                    <td className="num text-dim">{i + 1}</td>
                    <td>
                      <a className="link num" href={mainAddr(x.address)} target="_blank" rel="noreferrer">{short(x.address)}</a>
                      {(x.contract || x.name) && <span className="block text-xs text-dim">{x.name ?? "Contract"}</span>}
                    </td>
                    <td className="num">{amount(x.amount)}</td>
                    <td className="num">{c ? `${((x.amount / c.supply) * 100).toFixed(2)}%` : "–"}</td>
                    <td className="num">{c?.priceUsd ? usd(x.amount * c.priceUsd) : "–"}</td>
                    <td className="text-right">
                      {!x.contract && (
                        <Link className="btn btn-o h-8 text-xs" href={`/offers/new?side=bid&token=${token}&taker=${x.address}`}>Bid privately</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense><Wallets /></Suspense>;
}
