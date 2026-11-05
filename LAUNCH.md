# Kerb — launch kit

**Name** Kerb · **Ticker** $KERB · **Domain** kerbtrade.xyz (bought 2026-11-05) · **X** @kerbtrade (to check/claim)
**Tagline** Trade the bag off the chart.
**Why the name** Kerb trading = deals struck outside the exchange, on the street kerb. Exactly what the desk does.
**Mark** `brand/logo.svg`: a kerb seen side on (road low, pavement up), one colour #f2c230, no stroke.

## Bio
OTC desk for Robinhood Chain. Sell your bag to one buyer, or bid for someone's. One transaction, wallet to wallet. The chart never sees it. $KERB

## Posts
1. Big bag on Robinhood Chain? Selling $10K into a thin Pons pool moves the chart for everyone. Kerb sells it to one buyer, at your price, in one tx. Chart: 0.0%. kerbtrade.xyz
2. (video "how it works") Lock the bag → buyer pays → both legs settle in the same transaction, or nothing moves.
3. Before you sign, Kerb shows what the same bag would get in the pools and how far the chart would fall. Read on chain from Pons curves and Uniswap v4, not guessed.
4. No server key, no off-chain signature. Your escrow can only go to a buyer on your terms, or back to you. Contract + tests open.
5. Bid privately for a whale's bag: Wallets lists the biggest holders of any coin, one click to make them an offer only they can take.
6. Fees: 0.3% paid by the taker. Makers pay nothing.

## Before going live
- ~~Deploy Desk on mainnet 4663~~ done 2026-11-05: 0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43, 0.0000358 ETH gas, verified on Sourcify.
- Film one real mainnet fill (needs a second wallet: the contract refuses self-fills).
- Launch $KERB, set NEXT_PUBLIC_KERB_TOKEN.
- Buy kerbtrade.xyz, claim @kerbtrade.
