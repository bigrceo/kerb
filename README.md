# Kerb — OTC deals for Solana tokens

Sell a whole bag to one buyer at a price you set, or bid for someone's bag. It settles wallet to wallet in one transaction; no pool is touched, so the chart does not move.

Live: https://kerbtrade.xyz

## How a deal works (no program, no custody)

A deal is one Solana transaction signed by both sides: the tokens one way, the SOL the other, a 0.3% fee to the treasury. The maker signs their part and shares a link; the one wallet named in it checks the terms and signs as fee payer. Both legs move together or not at all. Deals run on the maker's own durable nonce account, so a signed deal does not expire after a minute, and advancing the nonce cancels every deal signed on it. The buyer's page rebuilds the transaction from the stated terms and refuses any link whose signed message differs.

- `web/src/lib/sol/deal.ts` the whole mechanism: instructions, nonce, link encoding, the tamper check.
- `solana/deal-test.mts` end to end in LiteSVM: ask and bid settle with the exact fee, a tampered link is refused, a settled link cannot replay, a cancelled deal fails. `npx tsx solana/deal-test.mts`.
- `solana/mainnet-sim.mts` a deal simulated by a mainnet node against live state (nothing signed or sent).
- `web/` Next.js: home with live pool-impact ticker, Markets + sale simulator (DEX Screener reserves, constant-product model), Make a deal, Open a deal link, Docs.
- `solana/programs/kerb` an Anchor escrow program (public order book, partial fills), written and tested (11 LiteSVM tests), not deployed.

Dev: `cd web && npm i && npx next dev --port 4330`.

## Earlier: the EVM desk

- `contracts/` Foundry. `src/Desk.sol`: asks (tokens in escrow), bids (ETH in escrow), atomic fills, partial fills with a smallest fill, private offers, cancel, expiry + reclaim to the maker only, 0.3% taker fee. `forge test` (22 tests incl. fuzz) and `FORK=1 forge test --match-contract Fork --fork-url https://robinhood-rpc.publicnode.com` (a live Pons coin changes hands, its curve does not move).
- `web/` Next.js. Markets + sale simulator (Pons curves and graduated Uniswap v4 pools read on chain, other pools from DEX Screener), Pools, Offers, Positions, Make offer, Wallets (Blockscout holders), History (contract events), Docs.
- Brand: `web/src/lib/brand.ts` (single file), mark in `brand/logo.svg`.

## Deployed

| Network | Desk | Demo coin |
| --- | --- | --- |
| Robinhood Chain (4663) | `0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43` (block 107080602, tx `0xe2a9ff62…d196`, source verified exact match on Sourcify) | none |
| Robinhood Chain Testnet (46630) | `0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43` | KDEMO `0x747fAcbB5497869605a0BA9F635b175A3f66ED45` |

Same address on both chains (same deployer, nonce 0). The front defaults to mainnet; `NEXT_PUBLIC_DESK_CHAIN=46630` points it at the testnet desk. To redeploy:

```
cd contracts && PRIVATE_KEY=… TREASURY=… forge script script/Deploy.s.sol --tc Deploy --rpc-url https://rpc.mainnet.chain.robinhood.com --broadcast
NEXT_PUBLIC_DESK_CHAIN=4663 NEXT_PUBLIC_DESK=0x… NEXT_PUBLIC_DESK_FROM_BLOCK=<block> NEXT_PUBLIC_KERB_TOKEN=0x…
```

Dev: `cd web && npm i && npx next dev --port 4330` (config `offpool-rh` in karat's launch.json).
