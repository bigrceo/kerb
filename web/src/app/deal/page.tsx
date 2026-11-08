"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connect } from "@/components/Header";
import { LAMPORTS, decodeDeal, feeOf, readNonce } from "@/lib/sol/deal";

const solscan = (k: string, kind: "account" | "tx" | "token" = "account") => `https://solscan.io/${kind}/${k}`;
const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;

export default function Deal() {
  const [hash, setHash] = useState("");
  const [paste, setPaste] = useState("");
  useEffect(() => {
    const read = () => setHash(location.hash.slice(1));
    read();
    addEventListener("hashchange", read);
    return () => removeEventListener("hashchange", read);
  }, []);
  if (!hash)
    return (
      <div className="wrap py-8 max-w-2xl space-y-4">
        <h1 className="text-3xl font-extrabold tracking-tight">Open a deal link</h1>
        <p className="text-dim">Paste the Kerb link you were sent.</p>
        <input className="input num" placeholder="https://kerbtrade.xyz/deal#…" value={paste} onChange={(e) => setPaste(e.target.value)} />
        <button className="btn btn-a" disabled={!paste.includes("#")} onClick={() => (location.hash = paste.split("#")[1])}>Open</button>
      </div>
    );
  return <Settle code={hash} />;
}

function Settle({ code }: { code: string }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [state, setState] = useState<{ busy?: boolean; msg?: string; sig?: string }>({});
  let parsed: ReturnType<typeof decodeDeal> | null = null;
  try {
    parsed = decodeDeal(code);
  } catch {}
  // Still settleable only while the maker's nonce has not moved.
  const nonce = useQuery({
    queryKey: ["nonce", parsed?.terms.nonce.toBase58(), state.sig],
    enabled: !!parsed,
    refetchInterval: 15_000,
    queryFn: () => readNonce(connection, parsed!.terms.nonce),
  });
  if (!parsed || !parsed.valid)
    return <div className="wrap py-8"><h1 className="text-2xl font-bold">This link is broken or has been tampered with.</h1><p className="text-dim mt-2">Do not sign anything from it. Ask the sender for a new one.</p></div>;

  const { terms: t, tx } = parsed;
  const tokens = Number(t.amount) / 10 ** t.decimals;
  const sol = Number(t.total) / LAMPORTS, fee = Number(feeOf(t.total)) / LAMPORTS;
  const current = nonce.data && nonce.data.nonce === tx.recentBlockhash;
  const expired = t.expiry * 1000 < Date.now();
  const me = publicKey?.equals(t.taker);
  const status = state.sig ? "Settled" : nonce.isLoading ? "Checking…" : !current ? "Settled or cancelled" : expired ? "Expired" : "Open";

  async function settle() {
    if (!signTransaction) return;
    setState({ busy: true, msg: "Confirm in your wallet" });
    try {
      const signed = await signTransaction(tx);
      setState({ busy: true, msg: "Settling" });
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setState({ sig, msg: "Settled. Both legs moved in this one transaction." });
    } catch (e) {
      setState({ msg: (e as Error).message || "Failed. Nothing moved." });
    }
  }

  return (
    <div className="wrap py-8 grid lg:grid-cols-[1fr_380px] gap-6 items-start">
      <section className="card p-6 space-y-4 min-w-0">
        <div className="label">Kerb deal · {status}</div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {t.side === "ask" ? "Buy" : "Sell"} {tokens.toLocaleString("en-US")} tokens for {sol.toLocaleString("en-US", { maximumFractionDigits: 9 })} SOL
        </h1>
        <p className="text-dim">{(sol / tokens).toPrecision(4)} SOL per token. One transaction, wallet to wallet; no pool is touched.</p>
        <dl className="grid sm:grid-cols-2 gap-4 text-sm">
          <D k="Coin" v={<a className="link num" href={solscan(t.mint.toBase58(), "token")} target="_blank" rel="noreferrer">{short(t.mint.toBase58())}</a>} />
          <D k={t.side === "ask" ? "Seller" : "Buyer"} v={<a className="link num" href={solscan(t.maker.toBase58())} target="_blank" rel="noreferrer">{short(t.maker.toBase58())}</a>} />
          <D k="Only for" v={<span className="num">{short(t.taker.toBase58())}</span>} />
          <D k="Good until" v={new Date(t.expiry * 1000).toUTCString().replace("GMT", "UTC")} />
        </dl>
        <p className="text-xs text-dim">Check the coin address on Solscan before you sign. Kerb rebuilt this transaction from the terms above and it matches exactly.</p>
      </section>

      <aside className="card p-5 space-y-4 min-w-0">
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span className="text-dim">Tokens</span><span className="num">{tokens.toLocaleString("en-US")}</span></div>
          <div className="flex justify-between"><span className="text-dim">Price</span><span className="num">{sol.toFixed(6)} SOL</span></div>
          <div className="flex justify-between"><span className="text-dim">Fee, 0.3%</span><span className="num">{fee.toFixed(6)} SOL</span></div>
          <div className="flex justify-between font-semibold">
            <span>{t.side === "ask" ? "You pay" : "You receive"}</span>
            <span className="num">{(t.side === "ask" ? sol + fee : sol - fee).toFixed(6)} SOL</span>
          </div>
        </div>
        {!publicKey ? (
          <Connect />
        ) : !me ? (
          <p className="text-sm text-dim">This deal is for {short(t.taker.toBase58())}. Connect that wallet to settle it.</p>
        ) : status !== "Open" ? (
          <p className="text-sm text-dim">{status}.</p>
        ) : (
          <button className="btn btn-a w-full" disabled={state.busy} onClick={settle}>
            {state.busy ? state.msg : t.side === "ask" ? "Pay and take the bag" : "Send the tokens, take the SOL"}
          </button>
        )}
        {state.msg && !state.busy && (
          <p className="text-sm">
            {state.msg} {state.sig && <a className="link" href={solscan(state.sig, "tx")} target="_blank" rel="noreferrer">View on Solscan</a>}
          </p>
        )}
        <p className="text-xs text-dim">Both legs move in this one transaction, or neither does.</p>
      </aside>
    </div>
  );
}

function D({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="label">{k}</dt><dd className="mt-1">{v}</dd></div>;
}
