// The Kerb desk program on Solana (solana/programs/kerb): addresses, account layouts and instruction builders.
// Hand-written against the program's Rust source, so the web needs no Anchor client. Pure, no React.

import { PublicKey, SystemProgram, TransactionInstruction, type AccountInfo } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

export const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_SOL_PROGRAM || "Emkqjg3A7p2WYQTBiTLEhjczR2TeBP94E9PMhCpbq4ia");
export const FEE_BPS = 30n;

const IX = {
  postAsk: [128, 252, 28, 198, 3, 208, 70, 24],
  postBid: [2, 141, 102, 125, 123, 27, 205, 12],
  takeAsk: [187, 87, 43, 138, 13, 84, 175, 227],
  takeBid: [143, 227, 21, 28, 152, 128, 7, 10],
  closeAsk: [60, 30, 166, 71, 194, 243, 198, 121],
  closeBid: [169, 171, 66, 115, 220, 168, 231, 21],
};
export const CONFIG_DISC = [155, 12, 170, 224, 30, 250, 204, 130];
export const OFFER_DISC = [215, 88, 60, 71, 170, 162, 73, 229];

const u64 = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};
const i64 = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigInt64(0, v, true);
  return b;
};
const cat = (...parts: (Uint8Array | number[])[]) => Buffer.concat(parts.map((p) => Buffer.from(p)));

export const configPda = () => PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0];
export const offerPda = (id: bigint) => PublicKey.findProgramAddressSync([Buffer.from("offer"), u64(id)], PROGRAM_ID)[0];
export const ata = (owner: PublicKey, mint: PublicKey, tokenProgram: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);

/* --------------------------------- accounts -------------------------------- */

export type SolConfig = { admin: PublicKey; treasury: PublicKey; offerCount: bigint; volume: bigint; fills: bigint };
export type SolOffer = {
  id: bigint;
  address: PublicKey;
  maker: PublicKey;
  mint: PublicKey;
  /** null = anyone */
  taker: PublicKey | null;
  expiry: number;
  side: "ask" | "bid";
  open: boolean;
  amount: bigint;
  /** lamports */
  total: bigint;
  filled: bigint;
  minFill: bigint;
};

class Reader {
  o = 8;
  constructor(private d: Buffer) {}
  key() { const k = new PublicKey(this.d.subarray(this.o, this.o + 32)); this.o += 32; return k; }
  u64() { const v = this.d.readBigUInt64LE(this.o); this.o += 8; return v; }
  i64() { const v = this.d.readBigInt64LE(this.o); this.o += 8; return v; }
  u8() { return this.d[this.o++]; }
}

export function decodeConfig(a: AccountInfo<Buffer>): SolConfig {
  const r = new Reader(a.data);
  return { admin: r.key(), treasury: r.key(), offerCount: r.u64(), volume: r.u64(), fills: r.u64() };
}

export function decodeOffer(address: PublicKey, a: AccountInfo<Buffer>): SolOffer {
  const r = new Reader(a.data);
  const id = r.u64(), maker = r.key(), mint = r.key(), taker = r.key(), expiry = Number(r.i64()), side = r.u8(), open = r.u8() === 1;
  return {
    id, address, maker, mint,
    taker: taker.equals(PublicKey.default) ? null : taker,
    expiry, side: side === 0 ? "ask" : "bid", open,
    amount: r.u64(), total: r.u64(), filled: r.u64(), minFill: r.u64(),
  };
}

/* ---------------------------------- math ---------------------------------- */

const solAt = (o: SolOffer, tokens: bigint) => (o.total * tokens) / o.amount;
/** Lamports owed for the next `tokens` of an offer, and the taker fee: the program's own formula. */
export function quote(o: SolOffer, tokens: bigint) {
  const sol = solAt(o, o.filled + tokens) - solAt(o, o.filled);
  return { sol, fee: (sol * FEE_BPS) / 10_000n };
}
export const live = (o: SolOffer) => o.open && o.expiry * 1000 > Date.now();
export const left = (o: SolOffer) => o.amount - o.filled;

/* ------------------------------- instructions ------------------------------ */

const m = (pubkey: PublicKey, isWritable = false, isSigner = false) => ({ pubkey, isWritable, isSigner });

export function postAsk(a: { maker: PublicKey; id: bigint; mint: PublicKey; tokenProgram: PublicKey; amount: bigint; total: bigint; minFill: bigint; taker: PublicKey | null; expiry: bigint }) {
  const offer = offerPda(a.id);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      m(a.maker, true, true), m(configPda(), true), m(offer, true), m(a.mint),
      m(ata(a.maker, a.mint, a.tokenProgram), true), m(ata(offer, a.mint, a.tokenProgram), true),
      m(a.tokenProgram), m(ASSOCIATED_TOKEN_PROGRAM_ID), m(SystemProgram.programId),
    ],
    data: cat(IX.postAsk, u64(a.amount), u64(a.total), u64(a.minFill), (a.taker ?? PublicKey.default).toBytes(), i64(a.expiry)),
  });
}

export function postBid(a: { maker: PublicKey; id: bigint; mint: PublicKey; amount: bigint; total: bigint; minFill: bigint; taker: PublicKey | null; expiry: bigint }) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [m(a.maker, true, true), m(configPda(), true), m(offerPda(a.id), true), m(a.mint), m(SystemProgram.programId)],
    data: cat(IX.postBid, u64(a.amount), u64(a.total), u64(a.minFill), (a.taker ?? PublicKey.default).toBytes(), i64(a.expiry)),
  });
}

export function takeAsk(a: { taker: PublicKey; offer: SolOffer; treasury: PublicKey; tokenProgram: PublicKey; tokens: bigint }) {
  const o = a.offer;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      m(a.taker, true, true), m(configPda(), true), m(o.address, true), m(o.maker, true), m(a.treasury, true), m(o.mint),
      m(ata(o.address, o.mint, a.tokenProgram), true), m(ata(a.taker, o.mint, a.tokenProgram), true),
      m(a.tokenProgram), m(ASSOCIATED_TOKEN_PROGRAM_ID), m(SystemProgram.programId),
    ],
    data: cat(IX.takeAsk, u64(a.tokens)),
  });
}

export function takeBid(a: { taker: PublicKey; offer: SolOffer; treasury: PublicKey; tokenProgram: PublicKey; tokens: bigint }) {
  const o = a.offer;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      m(a.taker, true, true), m(configPda(), true), m(o.address, true), m(o.maker), m(a.treasury, true), m(o.mint),
      m(ata(a.taker, o.mint, a.tokenProgram), true), m(ata(o.maker, o.mint, a.tokenProgram), true),
      m(a.tokenProgram), m(ASSOCIATED_TOKEN_PROGRAM_ID), m(SystemProgram.programId),
    ],
    data: cat(IX.takeBid, u64(a.tokens)),
  });
}

/** Cancel (the maker) or reclaim after expiry (anyone). The escrow only ever goes back to the maker. */
export function closeOffer(a: { signer: PublicKey; offer: SolOffer; tokenProgram: PublicKey }) {
  const o = a.offer;
  if (o.side === "bid")
    return new TransactionInstruction({ programId: PROGRAM_ID, keys: [m(a.signer, false, true), m(o.address, true), m(o.maker, true)], data: cat(IX.closeBid) });
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      m(a.signer, true, true), m(o.address, true), m(o.maker, true), m(o.mint),
      m(ata(o.address, o.mint, a.tokenProgram), true), m(ata(o.maker, o.mint, a.tokenProgram), true),
      m(a.tokenProgram), m(ASSOCIATED_TOKEN_PROGRAM_ID), m(SystemProgram.programId),
    ],
    data: cat(IX.closeAsk),
  });
}
