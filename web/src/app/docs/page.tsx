import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Docs" };

const S = [
  ["what", "What this is"],
  ["why", "Why not the pool"],
  ["how", "How a deal works"],
  ["sign", "What you sign"],
  ["funds", "Where funds sit"],
  ["fees", "Fees"],
  ["trust", "Who you trust"],
  ["risks", "Risks"],
] as const;

export default function Docs() {
  return (
    <div className="wrap py-10 grid lg:grid-cols-[200px_1fr] gap-10">
      <nav className="hidden lg:block sticky top-28 self-start space-y-2 text-sm">
        {S.map(([id, t]) => <a key={id} href={`#${id}`} className="block text-dim hover:text-fg">{t}</a>)}
      </nav>
      <article className="max-w-2xl space-y-10 leading-relaxed">
        <header>
          <h1 className="text-4xl font-extrabold tracking-tight">How {BRAND.name} works</h1>
          <p className="text-dim mt-3">What a deal does, what it asks you to trust, and what can go wrong. {BRAND.origin}</p>
        </header>
        <section id="what" className="space-y-3">
          <h2 className="text-2xl font-bold">What this is</h2>
          <p>{BRAND.name} lets two wallets agree a price on a whole bag of a Solana token and settle it in one transaction. You sell a bag for SOL, or bid SOL for one, to one named wallet.</p>
        </section>
        <section id="why" className="space-y-3">
          <h2 className="text-2xl font-bold">Why not the pool</h2>
          <p>Most coins live in thin pools: a pump.fun bonding curve, then a PumpSwap pool. A pool prices each trade on a curve, so a big sale pushes the price down for everyone and shows on the chart. A deal between two wallets touches no pool, so the chart does not move.</p>
        </section>
        <section id="how" className="space-y-3">
          <h2 className="text-2xl font-bold">How a deal works</h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>The maker picks the coin, the size, the price in SOL and the one wallet that can settle. Kerb builds the swap: the tokens one way, the SOL the other, the fee to the treasury.</li>
            <li>The maker signs their part and gets a link. The link carries the terms and the signed transaction, in the part of the URL that is never sent to a server.</li>
            <li>The other wallet opens the link. Kerb rebuilds the swap from the stated terms and refuses the link unless the signed transaction is exactly that swap. They sign as fee payer and send it.</li>
            <li>Both legs move in that one transaction, or neither does.</li>
          </ol>
        </section>
        <section id="sign" className="space-y-3">
          <h2 className="text-2xl font-bold">What you sign</h2>
          <p>Plain Solana instructions: a System Program nonce advance, an idempotent token account creation, one token transfer and one or two SOL transfers. No program of ours, no approval, no delegate. Your wallet shows each one before you sign.</p>
          <p>Deals run on the maker&apos;s own durable nonce account, set up once (about 0.0015 SOL of rent, the maker&apos;s, closable any time), so a signed deal does not expire after a minute. Settling a deal moves the nonce, so a link works once.</p>
        </section>
        <section id="funds" className="space-y-3">
          <h2 className="text-2xl font-bold">Where funds sit</h2>
          <p>In your wallet. There is no escrow: nothing leaves until the deal settles. If the maker no longer holds the tokens or the SOL by then, the transaction fails and nothing moves.</p>
          <p>To cancel, the maker advances their nonce from the Make a deal page. Every deal they signed before becomes void at once.</p>
        </section>
        <section id="fees" className="space-y-3">
          <h2 className="text-2xl font-bold">Fees</h2>
          <p>0.3% of the SOL leg goes to the {BRAND.name} treasury inside the same transaction. On a sale the buyer pays it on top; on a bid it comes out of the SOL the seller receives. Plus the Solana network fee, paid by whoever settles.</p>
        </section>
        <section id="trust" className="space-y-3">
          <h2 className="text-2xl font-bold">Who you trust</h2>
          <p>Nobody holds your funds. You trust your wallet to show you what you sign, and this page to build the swap it says. The link check above means a tampered link is refused before you can sign it.</p>
        </section>
        <section id="risks" className="space-y-3">
          <h2 className="text-2xl font-bold">Risks</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><b>Check the coin address.</b> Anyone can make a token with any name. The deal page shows the mint; check it on Solscan.</li>
            <li><b>Good until is not enforced on chain.</b> The app refuses expired deals, but a signed transaction stays valid until it settles or the maker cancels. Cancel deals you no longer want.</li>
            <li><b>Price.</b> A deal settles at the price in it, whatever the market does after you sign.</li>
          </ul>
        </section>
      </article>
    </div>
  );
}
