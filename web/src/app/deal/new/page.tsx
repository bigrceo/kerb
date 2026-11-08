"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connect } from "@/components/Header";
import { LAMPORTS, buildDeal, cancelAll, encodeDeal, feeOf, mintInfo, nonceSetup, readNonce, type Terms } from "@/lib/sol/deal";

const DURATIONS = [
  ["1 hour", 3600],
  ["1 day", 86400],
  ["3 days", 3 * 86400],
  ["7 days", 7 * 86400],
] as const;

const key = (s: string) => {
  try {
    return new PublicKey(s.trim());
  } catch {
    return null;
  }
};
const toUnits = (s: string, d: number) => {
  const [w, f = ""] = s.split(".");
  return BigInt(w || "0") * 10n ** BigInt(d) + BigInt((f + "0".repeat(d)).slice(0, d) || "0");
};
const store = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {}
  return null;
};

function Ticket() {
  const sp = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [side, setSide] = useState<"ask" | "bid">(sp.get("side") === "bid" ? "bid" : "ask");
  const [mintS, setMint] = useState(sp.get("token") ?? "");
  const [qty, setQty] = useState("");
  const [total, setTotal] = useState("");
  const [takerS, setTaker] = useState(sp.get("taker") ?? "");
  const [dur, setDur] = useState<number>(86400);
  const [nonce, setNonce] = useState<PublicKey | null>(null);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const mint = key(mintS), taker = key(takerS);
  const meta = useQuery({
    queryKey: ["mint", mintS, publicKey?.toBase58()],
    enabled: !!mint,
    queryFn: async () => {
      const m = await mintInfo(connection, mint!);
      let bal = 0n;
      if (publicKey) {
        const b = await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint!, publicKey, true, m.tokenProgram)).catch(() => null);
        bal = b ? BigInt(b.value.amount) : 0n;
      }
      return { ...m, bal };
    },
  });

  // The maker's nonce, remembered per wallet and checked on chain.
  useEffect(() => {
    setNonce(null);
    if (!publicKey) return;
    const s = store(`kerb-nonce-${publicKey.toBase58()}`);
    const k = s ? key(s) : null;
    if (k) readNonce(connection, k).then((n) => n && n.authorizedPubkey.equals(publicKey) && setNonce(k)).catch(() => {});
  }, [publicKey, connection]);

  const d = meta.data?.decimals ?? 0;
  const amt = meta.data && qty ? toUnits(qty, d) : 0n;
  const lam = total ? toUnits(total, 9) : 0n;
  const fee = feeOf(lam);
  const shortBag = side === "ask" && meta.data && amt > meta.data.bal;
  const self = taker && publicKey && taker.equals(publicKey);
  const ready = publicKey && meta.data && amt > 0n && lam > 0n && taker && !self && !shortBag && nonce;

  async function setup() {
    if (!publicKey || !signTransaction) return;
    setBusy(true);
    setMsg("Confirm in your wallet");
    try {
      const { tx, nonce: n } = await nonceSetup(connection, publicKey);
      const signed = await signTransaction(tx);
      setMsg("Settling");
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      store(`kerb-nonce-${publicKey.toBase58()}`, n.toBase58());
      setNonce(n);
      setMsg("Ready. You can sign deals now.");
    } catch (e) {
      setMsg((e as Error).message || "Failed");
    }
    setBusy(false);
  }

  async function sign() {
    if (!ready || !signTransaction) return;
    setBusy(true);
    setMsg("Confirm in your wallet");
    try {
      const t: Terms = {
        side,
        maker: publicKey!,
        taker: taker!,
        mint: mint!,
        tokenProgram: meta.data!.tokenProgram,
        decimals: d,
        amount: amt,
        total: lam,
        nonce: nonce!,
        expiry: Math.floor(Date.now() / 1000) + dur,
      };
      const tx = await buildDeal(connection, t);
      const signed = await signTransaction(tx);
      setLink(`${location.origin}/deal#${encodeDeal(t, signed)}`);
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message || "Failed");
    }
    setBusy(false);
  }

  async function cancel() {
    if (!publicKey || !signTransaction || !nonce) return;
    setBusy(true);
    try {
      const signed = await signTransaction(await cancelAll(connection, publicKey, nonce));
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setLink("");
      setMsg("Every deal you signed before is now void.");
    } catch (e) {
      setMsg((e as Error).message || "Failed");
    }
    setBusy(false);
  }

  return (
    <div className="wrap py-8 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <section className="card p-5 sm:p-6 space-y-5 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Make a deal</h1>
          <div className="seg ml-auto">
            <button aria-pressed={side === "ask"} onClick={() => setSide("ask")}>Sell a bag</button>
            <button aria-pressed={side === "bid"} onClick={() => setSide("bid")}>Bid for a bag</button>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="mint">Coin address</label>
          <input id="mint" className="input num mt-2" placeholder="Mint address" value={mintS} onChange={(e) => setMint(e.target.value.trim())} />
          {mintS && !mint && <p className="text-xs text-down mt-1">Not an address</p>}
          {mint && meta.isError && <p className="text-xs text-down mt-1">No such coin on Solana</p>}
          {meta.data && publicKey && (
            <p className="text-xs text-dim mt-2 num">You hold {(Number(meta.data.bal) / 10 ** d).toLocaleString("en-US")}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="qty">Tokens {side === "ask" ? "to sell" : "to buy"}</label>
            <input id="qty" className="input num mt-2" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9.]/g, ""))} />
            {side === "ask" && meta.data && (
              <button className="text-xs link mt-1" onClick={() => setQty(String(Number(meta.data!.bal) / 10 ** d))}>Whole bag</button>
            )}
          </div>
          <div>
            <label className="label" htmlFor="total">Total, SOL</label>
            <input id="total" className="input num mt-2" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))} />
            <p className="text-xs text-dim mt-1 num">{qty && total ? `${(Number(total) / Number(qty)).toPrecision(4)} SOL per token` : " "}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="taker">{side === "ask" ? "Buyer" : "Seller"} wallet</label>
            <input id="taker" className="input num mt-2" placeholder="The one wallet that can settle it" value={takerS} onChange={(e) => setTaker(e.target.value.trim())} />
            {takerS && !taker && <p className="text-xs text-down mt-1">Not an address</p>}
            {self && <p className="text-xs text-down mt-1">That is your own wallet</p>}
          </div>
          <div>
            <div className="label">Stands for</div>
            <div className="seg mt-2 w-full grid! grid-cols-4">
              {DURATIONS.map(([l, s]) => (
                <button key={s} className="flex-1" aria-pressed={dur === s} onClick={() => setDur(s)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap gap-3 items-center">
          {!publicKey ? (
            <Connect />
          ) : !nonce ? (
            <button className="btn btn-a" disabled={busy} onClick={setup}>{busy ? msg : "Set up deals (once, ~0.0015 SOL, yours)"}</button>
          ) : (
            <button className="btn btn-a" disabled={!ready || busy} onClick={sign}>{busy ? msg : "Sign the deal"}</button>
          )}
          {shortBag && <p className="text-sm text-down">You do not hold that many.</p>}
          {msg && !busy && <p className="text-sm">{msg}</p>}
        </div>

        {link && (
          <div className="border-t border-line pt-4 space-y-2">
            <div className="label">Send this link to the {side === "ask" ? "buyer" : "seller"}</div>
            <div className="flex gap-2">
              <input className="input num text-xs" readOnly value={link} onFocus={(e) => e.target.select()} />
              <button className="btn btn-o" onClick={() => navigator.clipboard?.writeText(link)}>Copy</button>
            </div>
            <p className="text-xs text-dim">Only that wallet can settle it. Nothing moves until they sign.</p>
          </div>
        )}
        {nonce && (
          <button className="text-xs link" disabled={busy} onClick={cancel}>Cancel every deal I have signed</button>
        )}
      </section>

      <aside className="card p-5 space-y-4 lg:sticky lg:top-24 min-w-0">
        <h2 className="font-bold">Before you sign</h2>
        <Row k={side === "ask" ? "You send on settle" : "You pay on settle"} v={side === "ask" ? `${qty || 0} tokens` : `${total || 0} SOL`} />
        <Row k="You receive" v={side === "ask" ? `${total || 0} SOL` : `${qty || 0} tokens`} />
        <Row k={side === "ask" ? "Buyer pays the fee" : "Fee, from the SOL leg"} v={`${(Number(fee) / LAMPORTS).toFixed(6)} SOL (0.3%)`} />
        <p className="text-xs text-dim border-t border-line pt-4">
          No escrow. Your {side === "ask" ? "tokens" : "SOL"} stay in your wallet until the {side === "ask" ? "buyer" : "seller"} settles: then both legs move in one
          transaction, or neither does. If they are gone by then, the deal just fails. Cancel every signed deal at any time.
        </p>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-dim">{k}</span>
      <span className="num font-semibold text-right">{v}</span>
    </div>
  );
}

export default function Page() {
  return <Suspense><Ticket /></Suspense>;
}
