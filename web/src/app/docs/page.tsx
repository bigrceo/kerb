import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { DESK, DESK_CHAIN, ON_TESTNET, PONS, V4, deskAddr } from "@/lib/chain";

export const metadata: Metadata = { title: "Docs" };

const S = [
  ["what", "What this is"],
  ["why", "Why not the pool"],
  ["model", "How the sale is modelled"],
  ["offers", "Asks, bids, private offers"],
  ["sign", "What you sign"],
  ["funds", "Where funds sit"],
  ["fees", "Fees"],
  ["trust", "Who you trust"],
  ["risks", "Risks"],
  ["edition", "This edition"],
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
          <p className="text-dim mt-3">What the desk does, what it asks you to trust, and what in this edition is real. {BRAND.origin}</p>
        </header>
        <Sec id="what" t="What this is">
          <p>{BRAND.name} is a place to agree a price on a whole bag of a Solana token with one other wallet. You post an ask (a bag for SOL) or a bid (SOL for a bag), public or private to one wallet. When someone takes it, tokens and SOL swap in one transaction, both legs or neither. No pool is touched, so no pool price moves.</p>
        </Sec>
        <Sec id="why" t="Why not the pool">
          <p>On Solana most coins live in thin pools: a pump.fun bonding curve, then a full-range PumpSwap pool once they graduate. A pool prices each trade on a curve, so a sale that is large against it fills worse as it goes, and the price it leaves behind is what everyone sees on the chart. Two numbers come out of a big sale: the average fill, which the seller loses, and the chart move, which the market sees. On the desk both are zero.</p>
        </Sec>
        <Sec id="model" t="How the sale is modelled">
          <ul className="list-disc pl-5 space-y-2">
            <li><b>pump.fun bonding curve</b>, read on chain from the curve contract: its reserves, curve fee and creator tax, in pump.fun&apos; own constant-product formula. Exact outside the first seconds&apos; snipe tax.</li>
            <li><b>Graduated pump.fun pool</b> on PumpSwap, read on chain through the PoolManager ({V4.poolManager.slice(0, 10)}…): price and liquidity. The pump.fun position is full range, so its virtual reserves are exact. Only the pool fee is counted, not the pump.fun hook fee, so real fills are a little worse than shown.</li>
            <li><b>Any other pool</b> DEX Screener lists for the coin: constant product with half its USD value on each side. An estimate, labelled as one.</li>
          </ul>
          <p>A sale is cut into 400 slices and each goes to the venue that pays most for it at that moment, the way an aggregator routes. The chart move is the deepest venue&apos;s price after the sale against before. Coins come from the pump.fun factory ({PONS.factory.slice(0, 10)}…): every SOL-paired coin that graduated, ranked by the SOL in its pool, plus the deepest curves launched in the last week.</p>
        </Sec>
        <Sec id="offers" t="Asks, bids, private offers">
          <ul className="list-disc pl-5 space-y-2">
            <li>An <b>ask</b> locks your tokens in the desk and names a total in SOL. Fee-on-transfer and rebasing tokens are refused at the deposit.</li>
            <li>A <b>bid</b> locks your SOL and names an amount of a token. A holder sends the tokens straight to you; the desk never holds them.</li>
            <li>A <b>private</b> offer names one wallet. The contract refuses a fill from anyone else.</li>
            <li>An offer stands 1 hour to 7 days (30 at most on the contract), may allow partial fills down to a smallest fill, and can be cancelled any time. Partial fills round so they always add up to the exact total.</li>
          </ul>
        </Sec>
        <Sec id="sign" t="What you sign">
          <p>Ordinary transactions to the desk contract, nothing off chain. To sell: one approval for exactly the bag, then <code>postAsk</code>. To bid: <code>postBid</code> with the SOL attached. To take an ask: <code>takeAsk</code> with the price plus fee, to the wei. To take a bid: an approval for exactly the tokens, then <code>takeBid</code>. There is no server key, no signature to a backend, and no allowance left behind beyond what you approve.</p>
        </Sec>
        <Sec id="funds" t="Where funds sit">
          <p>In your wallet until you post. Then only the escrow of that offer sits in the desk contract, and only three things can move it: a fill on the terms you set, your cancel, or a reclaim after expiry. A cancel or a reclaim pays the maker and nobody else, whoever sends it. The contract keeps no balance of its own: fees go straight to the treasury inside the fill.</p>
        </Sec>
        <Sec id="fees" t="Fees">
          <table className="t">
            <tbody>
              <tr><td>Taker fee</td><td className="num">0.3% of the SOL leg, fixed in the contract</td></tr>
              <tr><td>Maker fee</td><td>None</td></tr>
              <tr><td>Cancel, reclaim</td><td>Gas only</td></tr>
            </tbody>
          </table>
        </Sec>
        <Sec id="trust" t="Who you trust">
          <ul className="list-disc pl-5 space-y-2">
            <li><b>The contract</b>, <a className="link num" href={deskAddr(DESK)} target="_blank" rel="noreferrer">{DESK}</a> on {DESK_CHAIN.name}. Its admin can change only where fees go. It cannot touch an escrow, pause fills or change the fee.</li>
            <li><b>Not audited.</b> It has its own Foundry tests, including fuzzing and attacks (reentrancy, tax tokens, wallets that refuse SOL), and a mainnet-fork test with a live pump.fun coin, but no outside audit.</li>
            <li><b>Market data.</b> Curve and pool reserves are read on chain; names, 24h change and non-pump.fun pools come from DEX Screener; holders from Solscan. When they are wrong, an estimate is wrong.</li>
          </ul>
        </Sec>
        <Sec id="risks" t="Risks">
          <ul className="list-disc pl-5 space-y-2">
            <li>The other side may know more than you. Someone who wants out of a bag quietly may know why.</li>
            <li>A price set now can be far from the market later. Use an expiry you can watch.</li>
            <li>A wallet that refuses SOL cannot be paid, so its asks cannot fill. It can still cancel.</li>
          </ul>
        </Sec>
        <Sec id="edition" t="This edition">
          <p>{ON_TESTNET ? `The desk runs on ${DESK_CHAIN.name} (${DESK_CHAIN.id}) for now. Market data is mainnet; real Solana coins do not exist on testnet, so fills there use a demo coin (KDEMO). The same contract goes to mainnet unchanged.` : <>The desk runs on {DESK_CHAIN.name} ({DESK_CHAIN.id}). Its source is verified, exact match, on <a className="link" href={`https://repo.sourcify.dev/${DESK_CHAIN.id}/${DESK}`}>Sourcify</a>.</>}</p>
          <p className="mt-3"><b>${BRAND.ticker}</b> is the desk&apos;s token. {BRAND.tokenAddress && `Address: ${BRAND.tokenAddress}.`}</p>
        </Sec>
      </article>
    </div>
  );
}

function Sec({ id, t, children }: { id: string; t: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-3">
      <h2 className="text-xl font-bold">{t}</h2>
      {children}
    </section>
  );
}
