// Kerb on Solana, without a program: a deal is one transaction signed by both sides.
//
// The maker builds the swap (tokens one way, SOL the other, the 0.3% taker fee to the treasury), signs their part
// and shares it as a link. The buyer named in the deal checks the terms, signs as fee payer and sends it. Both legs
// move in that one transaction or neither does; no pool is touched.
//
// A normal transaction expires after ~1 minute, so every deal runs on the maker's own durable nonce account
// (~0.0015 SOL of rent, the maker's, closable any time). Advancing the nonce cancels every deal signed on it.
// No escrow: the maker's tokens (or SOL) stay in their wallet until the fill; if they are gone, the fill fails.

import {
  Connection,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  NonceAccount,
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";

export const FEE_BPS = 30n;
export const TREASURY = new PublicKey(process.env.NEXT_PUBLIC_SOL_TREASURY || "CwH8RKUttC69h6Tu2qjVq11iVcLYXpDNGyYEhfTj9irw");
export const RPC = process.env.NEXT_PUBLIC_SOL_RPC || "https://api.mainnet-beta.solana.com";
export const LAMPORTS = 1_000_000_000;

export type Terms = {
  side: "ask" | "bid";
  maker: PublicKey;
  taker: PublicKey;
  mint: PublicKey;
  tokenProgram: PublicKey;
  decimals: number;
  /** base units */
  amount: bigint;
  /** lamports, whole deal, fee excluded */
  total: bigint;
  nonce: PublicKey;
  /** unix seconds; shown to the buyer and checked by the app, not enforceable on chain */
  expiry: number;
};

export const feeOf = (total: bigint) => (total * FEE_BPS) / 10_000n;

export async function mintInfo(c: Connection, mint: PublicKey) {
  const a = await c.getAccountInfo(mint);
  if (!a) throw new Error("No such coin");
  const tokenProgram = a.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(c, mint, "confirmed", tokenProgram);
  return { tokenProgram, decimals: m.decimals };
}

/** The maker's durable nonce: create it once (maker pays rent), reuse it for every deal. */
export async function nonceSetup(c: Connection, maker: PublicKey) {
  const kp = Keypair.generate();
  const rent = await c.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const tx = new Transaction().add(
    SystemProgram.createAccount({ fromPubkey: maker, newAccountPubkey: kp.publicKey, lamports: rent, space: NONCE_ACCOUNT_LENGTH, programId: SystemProgram.programId }),
    SystemProgram.nonceInitialize({ noncePubkey: kp.publicKey, authorizedPubkey: maker }),
  );
  tx.feePayer = maker;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  tx.partialSign(kp);
  return { tx, nonce: kp.publicKey };
}

export async function readNonce(c: Connection, nonce: PublicKey) {
  const a = await c.getAccountInfo(nonce);
  if (!a) return null;
  return NonceAccount.fromAccountData(a.data);
}

/** Cancels every deal signed on this nonce. */
export async function cancelAll(c: Connection, maker: PublicKey, nonce: PublicKey) {
  const tx = new Transaction().add(SystemProgram.nonceAdvance({ noncePubkey: nonce, authorizedPubkey: maker }));
  tx.feePayer = maker;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  return tx;
}

/** The swap itself. The buyer pays the network fee and any token account it needs. */
export function dealInstructions(t: Terms): TransactionInstruction[] {
  const fee = feeOf(t.total);
  const seller = t.side === "ask" ? t.maker : t.taker;
  const buyer = t.side === "ask" ? t.taker : t.maker;
  const from = getAssociatedTokenAddressSync(t.mint, seller, true, t.tokenProgram);
  const to = getAssociatedTokenAddressSync(t.mint, buyer, true, t.tokenProgram);
  const ixs = [
    SystemProgram.nonceAdvance({ noncePubkey: t.nonce, authorizedPubkey: t.maker }),
    createAssociatedTokenAccountIdempotentInstruction(t.taker, to, buyer, t.mint, t.tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID),
    createTransferCheckedInstruction(from, t.mint, to, seller, t.amount, t.decimals, [], t.tokenProgram),
  ];
  if (t.side === "ask") {
    // Buyer (taker) pays the price to the maker and the fee on top.
    ixs.push(SystemProgram.transfer({ fromPubkey: t.taker, toPubkey: t.maker, lamports: t.total }));
    if (fee > 0n) ixs.push(SystemProgram.transfer({ fromPubkey: t.taker, toPubkey: TREASURY, lamports: fee }));
  } else {
    // Buyer (maker) pays; the seller (taker) receives the price minus the fee.
    ixs.push(SystemProgram.transfer({ fromPubkey: t.maker, toPubkey: t.taker, lamports: t.total - fee }));
    if (fee > 0n) ixs.push(SystemProgram.transfer({ fromPubkey: t.maker, toPubkey: TREASURY, lamports: fee }));
  }
  return ixs;
}

export async function buildDeal(c: Connection, t: Terms) {
  const n = await readNonce(c, t.nonce);
  if (!n) throw new Error("Nonce account not found");
  const tx = new Transaction().add(...dealInstructions(t));
  tx.feePayer = t.taker;
  tx.recentBlockhash = n.nonce;
  return tx;
}

/* ------------------------------- the link -------------------------------- */

const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Everything the buyer needs, in the URL fragment (never sent to a server): terms + the maker-signed transaction. */
export function encodeDeal(t: Terms, signed: Transaction) {
  const j = {
    v: 1,
    s: t.side,
    m: t.maker.toBase58(),
    k: t.taker.toBase58(),
    t: t.mint.toBase58(),
    p: t.tokenProgram.toBase58(),
    d: t.decimals,
    a: t.amount.toString(),
    l: t.total.toString(),
    n: t.nonce.toBase58(),
    e: t.expiry,
    x: b64u(signed.serialize({ requireAllSignatures: false, verifySignatures: false })),
  };
  return b64u(Buffer.from(JSON.stringify(j)));
}

/** Decodes a link and rebuilds the swap from the stated terms: the signed message must be exactly that swap. */
export function decodeDeal(s: string) {
  const j = JSON.parse(unb64u(s).toString());
  const t: Terms = {
    side: j.s,
    maker: new PublicKey(j.m),
    taker: new PublicKey(j.k),
    mint: new PublicKey(j.t),
    tokenProgram: new PublicKey(j.p),
    decimals: j.d,
    amount: BigInt(j.a),
    total: BigInt(j.l),
    nonce: new PublicKey(j.n),
    expiry: j.e,
  };
  const tx = Transaction.from(unb64u(j.x));
  // Never trust the transaction's own contents: rebuild from the terms and require the same message.
  const expected = new Transaction().add(...dealInstructions(t));
  expected.feePayer = t.taker;
  expected.recentBlockhash = tx.recentBlockhash;
  const same = Buffer.from(expected.serializeMessage()).equals(Buffer.from(tx.serializeMessage()));
  const makerSig = tx.signatures.find((s) => s.publicKey.equals(t.maker))?.signature;
  let sigOk = false;
  try {
    sigOk = tx.verifySignatures(false);
  } catch {}
  return { terms: t, tx, valid: same && !!makerSig && sigOk };
}
