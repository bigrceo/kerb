import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  ["1", "You set the deal", "Pick the coin, how many, your price in SOL, and who gets to buy. Sign once with your wallet."],
  ["2", "You send a link", "Kerb gives you a link. Send it to your buyer: DM, Telegram, anywhere."],
  ["3", "They accept", "Your buyer opens the link, checks the deal and signs. The coins and the SOL swap in one go. Done."],
] as const;

const FAQ = [
  ["Why not just sell on the chart?", "Selling a big bag into a pool pushes the price down for everyone, and you get less the more you sell. On Kerb you sell to one person at a fixed price, so the chart does not move and you get exactly what you agreed."],
  ["Can someone run off with my coins?", "No. Nothing leaves your wallet until your buyer accepts, and then both sides move in the same transaction: you get the SOL at the exact moment they get the coins. If anything is missing, nothing moves at all."],
  ["Does Kerb hold my money?", "Never. Your coins stay in your wallet the whole time. Kerb only prepares the deal; your wallet signs it."],
  ["What does it cost?", "0.3% of the SOL, paid by the buyer when they accept (on a bid, taken from the SOL the seller receives). Plus the usual tiny Solana network fee. Your first deal also sets aside about 0.0015 SOL in your own account so your deals stay valid for days; it stays yours."],
  ["Can I change my mind?", "Yes. Hit “Cancel every deal I have signed” on the Make a deal page and all your links stop working at once."],
  ["Can anyone take my deal?", "No. Only the one wallet you name can accept it. Someone else opening the link just sees the terms."],
  ["What should I check before accepting?", "The coin address (fakes can copy any name: compare it on Solscan) and the price. Kerb shows you how it compares to the market."],
] as const;

export default function Docs() {
  return (
    <div className="wrap py-12 max-w-4xl space-y-16">
      <header className="text-center space-y-4">
        <div className="label">How it works</div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight">Sell your bag without wrecking the chart.</h1>
        <p className="text-dim text-lg max-w-2xl mx-auto">
          {BRAND.name} lets you sell a big bag to one buyer, at your price, in one transaction. No pool, no price crash, no middleman.
        </p>
      </header>

      <section className="grid sm:grid-cols-3 gap-3">
        {STEPS.map(([n, t, d]) => (
          <div key={n} className="ticket good p-6 pb-8">
            <div className="num text-accent text-sm">STEP {n}</div>
            <h2 className="text-2xl font-bold mt-3">{t}</h2>
            <p className="text-dim mt-2">{d}</p>
          </div>
        ))}
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <div className="ticket bad p-6">
          <div className="num text-down text-sm">THE USUAL WAY</div>
          <h3 className="text-xl font-bold mt-3">Dump into the pool</h3>
          <ul className="text-dim mt-3 space-y-1">
            <li>✕ The price drops while you sell</li>
            <li>✕ You get less than the bag is worth</li>
            <li>✕ Everyone sees a big red candle</li>
          </ul>
        </div>
        <div className="ticket good p-6 pb-8">
          <div className="num text-accent text-sm">WITH KERB</div>
          <h3 className="text-xl font-bold mt-3">Sell to one buyer</h3>
          <ul className="text-dim mt-3 space-y-1">
            <li>✓ You pick the price</li>
            <li>✓ You get exactly that</li>
            <li>✓ The chart does not move</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-3xl font-extrabold tracking-tight">Questions</h2>
        {FAQ.map(([q, a]) => (
          <details key={q} className="card p-5 group">
            <summary className="cursor-pointer font-semibold text-lg list-none flex justify-between gap-4">
              {q}
              <span className="text-dim group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="text-dim mt-3">{a}</p>
          </details>
        ))}
      </section>

      <section className="text-center space-y-4">
        <h2 className="text-3xl font-extrabold tracking-tight">Ready?</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/deal/new" className="btn btn-a px-8">Make a deal</Link>
          <Link href="/markets" className="btn btn-o">See what a sale does to the chart</Link>
        </div>
      </section>

      <details className="card p-5 text-sm">
        <summary className="cursor-pointer font-semibold">For the technical: what you actually sign</summary>
        <div className="text-dim mt-3 space-y-3">
          <p>A deal is one Solana transaction signed by both sides: a System Program nonce advance, an idempotent token account creation, one token transfer and one or two SOL transfers (the price, and the 0.3% fee to the treasury). No program of ours, no approval, no delegate.</p>
          <p>The maker signs first; the link carries the terms and that signed transaction in the URL fragment, which is never sent to a server. The buyer&apos;s page rebuilds the transaction from the terms and refuses the link unless the signed message is exactly that swap.</p>
          <p>Deals run on the maker&apos;s own durable nonce account, so they do not expire after a minute. Settling moves the nonce (a link works once); cancelling advances it (every earlier link dies). The good-until date is checked by the app, not on chain.</p>
          <p>Open source: <a className="link" href={BRAND.github} target="_blank" rel="noreferrer">{BRAND.github.replace("https://", "")}</a></p>
        </div>
      </details>
    </div>
  );
}
