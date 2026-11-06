# Kerb — X launch pack (@kerbtrade)

## Tone
One sentence per line. Lowercase is fine. No exclamation marks, no rockets, one emoji max per post.
Banned: moon, 100x, gem, guaranteed, yield, APY, "up to", audited, partnership (none exists), "trustless" (say what it does instead).
Say instead: desk, bag, one buyer, one transaction, wallet to wallet, the chart never sees it, escrow, fill, check it yourself.
No launch date anywhere: bio, banner and posts say the state, not the calendar.
Every number below is real (simulator read on chain on 2026-11-05, fill tx on mainnet). Anything not yet true is a `[placeholder]`.

## Profile

| Field | Value |
|---|---|
| Name | `Kerb` |
| Handle | `@kerbtrade` (backups: `@kerbdesk`, `@kerbotc`) |
| Bio (146 chars) | `OTC desk for Robinhood Chain. Sell your bag to one buyer, or bid for someone's. One transaction, wallet to wallet. The chart never sees it. $KERB` |
| Link | `kerbtrade.xyz` |
| Location | `Robinhood Chain` |
| Avatar | `img/pfp.png` (1024², the Kerb mark at its real geometry, kerb yellow on ink) |
| Banner | `img/x-banner.png` (1500×500, left third left empty for the avatar) |
| Pinned | post 1 (the article), then the LIVE post once it is out |

## Timeline

### Post 1 — X article (cover `img/A0-cover.png`, 5:2)

**Title:** Big bag? Keep the chart flat.

> [image : img/A0-cover.png]
>
> If you hold a real bag of a Robinhood Chain coin, you already know the problem.
> The pools are thin. A Pons curve, then a full-range Uniswap v4 pool once the coin graduates.
> Sell $50K of NOVAAI into its pool today and the chart drops 9.4%. You lose $2,399 to slippage and fees on the way out, and everyone watching sees a red candle with your name on it.
>
> Kerb is an OTC desk for Robinhood Chain.
> You sell the whole bag to one buyer, at a price you set. Or you bid for someone else's bag.
> It settles wallet to wallet, in one transaction. No pool is touched, so the chart does not move.
>
> **How it works**
>
> [image : img/T1-mechanic.png]
>
> 1. You lock the bag in the desk contract and name your price, in ETH.
> 2. A buyer takes it. Tokens go to the buyer and ETH goes to you in the same transaction, or nothing moves at all.
> 3. Don't want a public offer? Name the one wallet that can take it.
> 4. Changed your mind? Cancel any time and the escrow comes back to you. After the expiry, it can only ever go back to you.
>
> **See the cost before you sign**
>
> [image : img/T2-simulator.png]
>
> Every offer page compares the desk with the pools: what the same bag would get if sold into its Pons curve or its Uniswap v4 pool, and how far the chart would fall.
> It is read on chain, not guessed.
>
> **Bid for a whale's bag**
>
> Wallets lists the biggest holders of any coin. One click makes them a private offer that only they can take.
>
> **It is live, and it works**
>
> [image : img/T3-proof.png]
>
> The desk is deployed on Robinhood Chain mainnet: `0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43`.
> Its source is verified, exact match, on Sourcify.
> The first fill is on chain: 1.086 NOVAAI for 0.0002 ETH, wallet to wallet, one transaction.
> robinhoodchain.blockscout.com/tx/0x761488f4858e6c658ea6b4d3a3db680a448515f2f611048356ad3ccd58209f78
>
> **What it costs**
>
> Makers pay nothing. Takers pay 0.3% on the ETH leg.
>
> **What the desk cannot do**
>
> There is no server key and no off-chain signature. Your escrow can go to a buyer on your terms, or back to you. Nowhere else.
>
> Trade the bag off the chart.
> kerbtrade.xyz

### Post 2 — the how it works video (`video/howitworks.mp4`)
```
one buyer. one transaction. the chart never sees it.
how kerb works, on robinhood chain mainnet.
kerbtrade.xyz
```

### Posts 3 → 7 (one or two a day after launch, each with its image)

3. `img/T3-proof.png`
```
first fill on the desk, mainnet.
1.086 NOVAAI for 0.0002 ETH. wallet to wallet. one transaction.
check it yourself:
robinhoodchain.blockscout.com/tx/0x761488f4858e6c658ea6b4d3a3db680a448515f2f611048356ad3ccd58209f78
```

4. `img/T2-simulator.png`
```
$50K of NOVAAI sold into its pool: chart −9.4%, $2,399 lost on the way out.
the same bag on kerb: 0.0%.
kerb shows you both numbers before you sign. read on chain, from pons curves and uniswap v4.
```

5. `img/T4-escrow.png`
```
no server key. no off-chain signature.
your escrow goes to a buyer on your terms, or back to you. nowhere else.
contract source verified on sourcify, exact match.
```

6. `img/T5-whales.png`
```
want a whale's bag without chasing the chart.
wallets lists the biggest holders of any coin.
one click makes them a private offer only they can take.
```

7. `img/T6-fees.png`
```
makers pay nothing.
takers pay 0.3% on the eth leg.
that's the whole fee schedule.
```

## OFF-TIMELINE — launch evening, 10 minutes apart

**T+0 · LIVE** — image `img/L1-live.png` (no ticker in the image). Fill in the CA before you schedule it, pin it right away.
```
we are live.
the kerb desk is open on robinhood chain.
$KERB
CA: 
kerbtrade.xyz
```

**T+10 · DEX PAID** — image `img/D1-dexpaid.png`. Nothing else in the text.
```
dex screener paid ✅
CA: 
```

## Recurring after launch
- **Fill of the day:** `fill #[n]: [tokens] [SYMBOL] for [x] ETH. chart move: 0.0%.` + the tx link.
- **Desk volume (weekly):** `this week on the desk: [x] ETH settled in [n] fills. read from the contract's events, kerbtrade.xyz/history.`
- **Replies to big sells:** when someone dumps into a thin pool, reply with the simulator for that coin: `the same bag on kerb: 0.0%.`

## Regenerate
`node compose.mjs` re-renders `img/` from `shots/` (copied from `../video/screens`, made by `../video/capture.mjs`).
