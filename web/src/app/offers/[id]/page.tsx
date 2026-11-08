"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { deskAbi, erc20, left, live, tokens, unitPrice, useOffers, useTx } from "@/lib/desk";
import { status } from "@/components/OfferRow";
import { Connect } from "@/components/Header";
import { DESK, ZERO, deskAddr, deskTx, short } from "@/lib/chain";
import { amount } from "@/lib/format";

export default function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = useOffers();
  const o = q.data?.[Number(id)];
  const { address } = useAccount();
  const client = usePublicClient();
  const tx = useTx();
  const [want, setWant] = useState("");

  const rest = o ? tokens(o, left(o)) : 0;
  const n = want === "" ? rest : Number(want) || 0;
  const fillAmt = o ? (want === "" ? left(o) : parseUnits(want, o.decimals)) : 0n;
  const quote = useQuery({
    queryKey: ["quote", id, fillAmt.toString()],
    enabled: !!o && fillAmt > 0n && !!client,
    queryFn: async () => (await client!.readContract({ address: DESK, abi: deskAbi, functionName: "quote", args: [BigInt(id), fillAmt] })) as [bigint, bigint],
  });
  const allow = useQuery({
    queryKey: ["allow", o?.token, address],
    enabled: !!o && o.side === "bid" && !!address,
    queryFn: () => client!.readContract({ address: o!.token, abi: erc20, functionName: "allowance", args: [address!, DESK] }),
  });

  if (q.isLoading) return <div className="wrap py-8 text-dim">Reading the desk…</div>;
  if (!o) return <div className="wrap py-8">No offer #{id}. <Link className="link" href="/offers">All offers</Link></div>;

  const me = address?.toLowerCase();
  const mine = o.maker.toLowerCase() === me;
  const allowed = o.taker === ZERO || o.taker.toLowerCase() === me;
  const [e, f] = quote.data ?? [0n, 0n];
  const after = () => { q.refetch(); quote.refetch(); allow.refetch(); };

  return (
    <div className="wrap py-8 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <section className="card p-6 space-y-4 min-w-0">
        <div className="label">Offer #{o.id} · {status(o)}</div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {o.side === "ask" ? "Selling" : "Buying"} {amount(tokens(o, o.amount))} {o.symbol}
        </h1>
        <p className="text-dim">
          for {(Number(o.total) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 8 })} SOL in all, {unitPrice(o).toPrecision(4)} SOL per token.
        </p>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <D k="Maker" v={<a className="link num" href={deskAddr(o.maker)} target="_blank" rel="noreferrer">{short(o.maker)}</a>} />
          <D k="Open to" v={o.taker === ZERO ? "Anyone" : <span className="num">{short(o.taker)}</span>} />
          <D k="Left" v={`${amount(rest)} ${o.symbol}`} />
          <D k="Smallest fill" v={o.minFill === o.amount ? "Whole offer" : `${amount(tokens(o, o.minFill))} ${o.symbol}`} />
          <D k="Ends" v={new Date(o.expiry * 1000).toUTCString().replace("GMT", "UTC")} />
          <D k="Coin" v={<a className="link num" href={deskAddr(o.token)} target="_blank" rel="noreferrer">{short(o.token)}</a>} />
        </dl>
      </section>

      <aside className="card p-5 space-y-4 min-w-0">
        {!address ? (
          <Connect />
        ) : mine ? (
          <>
            <h2 className="font-bold">Your offer</h2>
            {o.open ? (
              <button className="btn btn-o w-full" disabled={tx.busy} onClick={async () => { await tx.send({ address: DESK, abi: deskAbi, functionName: live(o) ? "cancel" : "reclaim", args: [BigInt(o.id)] }, "Escrow returned"); after(); }}>
                {tx.busy ? tx.msg : live(o) ? "Cancel and take the escrow back" : "Reclaim the escrow"}
              </button>
            ) : <p className="text-dim text-sm">Closed. Nothing left in escrow.</p>}
          </>
        ) : !live(o) ? (
          o.open ? (
            <button className="btn btn-o w-full" disabled={tx.busy} onClick={async () => { await tx.send({ address: DESK, abi: deskAbi, functionName: "reclaim", args: [BigInt(o.id)] }, "Escrow sent back to the maker"); after(); }}>
              Expired: send the escrow back to the maker
            </button>
          ) : <p className="text-dim text-sm">This offer is closed.</p>
        ) : !allowed ? (
          <p className="text-dim text-sm">This is a private offer for another wallet.</p>
        ) : (
          <>
            <h2 className="font-bold">{o.side === "ask" ? "Buy this bag" : "Sell into this bid"}</h2>
            {o.minFill !== o.amount && (
              <div>
                <label className="label" htmlFor="want">Tokens</label>
                <input id="want" className="input num mt-2" placeholder={`All ${rest}`} value={want} onChange={(e) => setWant(e.target.value.replace(/[^0-9.]/g, ""))} />
              </div>
            )}
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-dim">Tokens</span><span className="num">{amount(n)} {o.symbol}</span></div>
              <div className="flex justify-between"><span className="text-dim">Price</span><span className="num">{(Number(e) / 1e18).toFixed(8)} SOL</span></div>
              <div className="flex justify-between"><span className="text-dim">Fee, 0.3%</span><span className="num">{(Number(f) / 1e18).toFixed(8)} SOL</span></div>
              <div className="flex justify-between font-semibold"><span>{o.side === "ask" ? "You pay" : "You receive"}</span><span className="num">{(Number(o.side === "ask" ? e + f : e - f) / 1e18).toFixed(8)} SOL</span></div>
            </div>
            {o.side === "bid" && (allow.data ?? 0n) < fillAmt ? (
              <button className="btn btn-a w-full" disabled={tx.busy} onClick={async () => { await tx.send({ address: o.token, abi: erc20, functionName: "approve", args: [DESK, fillAmt] }, "Approved"); allow.refetch(); }}>
                {tx.busy ? tx.msg : `Approve exactly ${amount(n)} ${o.symbol}`}
              </button>
            ) : (
              <button className="btn btn-a w-full" disabled={tx.busy || !quote.data} onClick={async () => {
                await tx.send(o.side === "ask"
                  ? { address: DESK, abi: deskAbi, functionName: "takeAsk", args: [BigInt(o.id), fillAmt], value: e + f }
                  : { address: DESK, abi: deskAbi, functionName: "takeBid", args: [BigInt(o.id), fillAmt] }, "Settled");
                after();
              }}>
                {tx.busy ? tx.msg : o.side === "ask" ? "Pay and take the bag" : "Send the tokens, take the SOL"}
              </button>
            )}
            <p className="text-xs text-dim">Both legs move in this one transaction, or neither does.</p>
          </>
        )}
        {tx.msg && !tx.busy && <p className="text-sm">{tx.msg} {tx.hash && <a className="link" href={deskTx(tx.hash)} target="_blank" rel="noreferrer">View tx</a>}</p>}
      </aside>
    </div>
  );
}

function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="label">{k}</dt><dd className="mt-1">{v}</dd></div>;
}
