# Kerb — OTC desk for Robinhood Chain tokens

Sell a whole bag to one buyer at a price you set, or bid for someone's bag. Settles wallet to wallet in one transaction; no pool is touched, so the chart does not move.

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
