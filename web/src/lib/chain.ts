/**
 * Two networks are in play.
 *
 *  - MARKET: Robinhood Chain mainnet (4663). Prices, pools and the sale
 *    simulator always read the real chain.
 *  - DESK: where the Desk contract lives. Mainnet by default; set
 *    NEXT_PUBLIC_DESK_CHAIN=46630 to run the site against the testnet desk.
 */
export const MAINNET = {
  id: 4663,
  name: "Solana",
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  readRpc: "https://robinhood-rpc.publicnode.com",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

export const TESTNET = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  rpc: "https://rpc.testnet.chain.robinhood.com",
  readRpc: "https://rpc.testnet.chain.robinhood.com",
  explorer: "https://explorer.testnet.chain.robinhood.com",
} as const;

const deskChainId = Number(process.env.NEXT_PUBLIC_DESK_CHAIN ?? MAINNET.id);
export const DESK_CHAIN = deskChainId === MAINNET.id ? MAINNET : TESTNET;
export const DESK = (process.env.NEXT_PUBLIC_DESK ?? "0x87D17826A3178fBc151EC460AA6dA440d6e7Cd43") as `0x${string}`;
/** The desk has the same address on mainnet and testnet (same deployer, nonce 0). */
/** Block the desk was deployed at, so history scans start there. */
export const DESK_FROM_BLOCK = BigInt(process.env.NEXT_PUBLIC_DESK_FROM_BLOCK ?? (deskChainId === MAINNET.id ? "107080602" : "147910000"));
export const ON_TESTNET = DESK_CHAIN.id === TESTNET.id;
/** A plain ERC-20 on the testnet desk, so every flow can be tried end to end. */
export const DEMO_COIN = "0x747fAcbB5497869605a0BA9F635b175A3f66ED45" as const;

export const FEE_BPS = 30n;

export const V4 = {
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
} as const;

export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
} as const;

export const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const mainAddr = (a: string) => `${MAINNET.explorer}/address/${a}`;
export const mainToken = (a: string) => `${MAINNET.explorer}/token/${a}`;
export const deskAddr = (a: string) => `${DESK_CHAIN.explorer}/address/${a}`;
export const deskTx = (h: string) => `${DESK_CHAIN.explorer}/tx/${h}`;
export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
