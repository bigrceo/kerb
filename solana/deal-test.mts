// End-to-end in LiteSVM (local Solana runtime): nonce setup, ask and bid deals signed as links, co-signed, sent.
import { LiteSVM } from "/private/tmp/claude-501/-Users-rayane-offpool-rh/d5bccd66-d55d-4f97-bcb1-2883de6074f7/scratchpad/lsvm/node_modules/litesvm/dist/index.js";
import { Keypair, LAMPORTS_PER_SOL, NONCE_ACCOUNT_LENGTH, NonceAccount, SystemProgram, Transaction, PublicKey } from "../web/node_modules/@solana/web3.js/lib/index.cjs.js";
import { AccountLayout, MintLayout, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, ACCOUNT_SIZE, MINT_SIZE } from "../web/node_modules/@solana/spl-token/lib/cjs/index.js";
import { dealInstructions, decodeDeal, encodeDeal, feeOf, TREASURY, type Terms } from "../web/src/lib/sol/deal.ts";

const svm = new LiteSVM();
const maker = Keypair.generate(), taker = Keypair.generate(), mint = Keypair.generate().publicKey;
for (const k of [maker.publicKey, taker.publicKey, TREASURY]) svm.airdrop(k, BigInt(10 * LAMPORTS_PER_SOL));
const md = Buffer.alloc(MINT_SIZE);
MintLayout.encode({ mintAuthorityOption: 0, mintAuthority: PublicKey.default, supply: 2_000_000_000n, decimals: 6, isInitialized: true, freezeAuthorityOption: 0, freezeAuthority: PublicKey.default }, md);
svm.setAccount(mint, { lamports: LAMPORTS_PER_SOL, data: md, owner: TOKEN_PROGRAM_ID, executable: false });
const putTok = (owner: PublicKey, amount: bigint) => {
  const d = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode({ mint, owner, amount, delegateOption: 0, delegate: PublicKey.default, state: 1, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: PublicKey.default }, d);
  svm.setAccount(getAssociatedTokenAddressSync(mint, owner), { lamports: 2_039_280, data: d, owner: TOKEN_PROGRAM_ID, executable: false });
};
putTok(maker.publicKey, 1_000_000_000n); putTok(taker.publicKey, 50_000_000n);
const bal = (o: PublicKey) => { const a = svm.getAccount(getAssociatedTokenAddressSync(mint, o)); return a ? AccountLayout.decode(Buffer.from(a.data)).amount : 0n; };
const send = (tx: Transaction) => { const r = svm.sendTransaction(tx); if ("err" in r && typeof r.err === "function") throw new Error(String(r.err()) + "\n" + r.meta().logs().join("\n")); return r; };

// Nonce, as nonceSetup builds it.
const nk = Keypair.generate();
const nt = new Transaction().add(
  SystemProgram.createAccount({ fromPubkey: maker.publicKey, newAccountPubkey: nk.publicKey, lamports: 1_447_680, space: NONCE_ACCOUNT_LENGTH, programId: SystemProgram.programId }),
  SystemProgram.nonceInitialize({ noncePubkey: nk.publicKey, authorizedPubkey: maker.publicKey }),
);
nt.feePayer = maker.publicKey; nt.recentBlockhash = svm.latestBlockhash(); nt.sign(maker, nk); send(nt);
const nonceValue = () => NonceAccount.fromAccountData(Buffer.from(svm.getAccount(nk.publicKey)!.data)).nonce;

let ok = 0;
for (const side of ["ask", "bid"] as const) {
  svm.expireBlockhash();
  const t: Terms = { side, maker: maker.publicKey, taker: taker.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID, decimals: 6, amount: 10_000_000n, total: 2_000_000_000n, nonce: nk.publicKey, expiry: 0 };
  const tx = new Transaction().add(...dealInstructions(t)); tx.feePayer = taker.publicKey; tx.recentBlockhash = nonceValue();
  tx.partialSign(maker);
  const d = decodeDeal(encodeDeal(t, tx));
  if (!d.valid) throw new Error("valid link refused");
  const [m0, k0, tr0, mk0, tk0] = [svm.getBalance(maker.publicKey)!, svm.getBalance(taker.publicKey)!, svm.getBalance(TREASURY)!, bal(maker.publicKey), bal(taker.publicKey)];
  d.tx.partialSign(taker); send(d.tx);
  const fee = svm.getBalance(TREASURY)! - tr0;
  console.log(side, "treasury +", fee, "=", feeOf(t.total), "| maker tokens", bal(maker.publicKey) - mk0, "taker tokens", bal(taker.publicKey) - tk0, "| maker SOL", svm.getBalance(maker.publicKey)! - m0, "taker SOL", svm.getBalance(taker.publicKey)! - k0);
  if (fee !== feeOf(t.total)) throw new Error("fee"); ok++;
  // The same link cannot be replayed: the nonce moved.
  try { svm.expireBlockhash(); send(d.tx); throw new Error("replayed!"); } catch (e) { if ((e as Error).message === "replayed!") throw e; }
}
// Tampered terms are refused by the buyer's page.
const t: Terms = { side: "ask", maker: maker.publicKey, taker: taker.publicKey, mint, tokenProgram: TOKEN_PROGRAM_ID, decimals: 6, amount: 1n, total: 1_000_000n, nonce: nk.publicKey, expiry: 0 };
const tx = new Transaction().add(...dealInstructions(t)); tx.feePayer = taker.publicKey; tx.recentBlockhash = nonceValue(); tx.partialSign(maker);
const j = JSON.parse(Buffer.from(encodeDeal(t, tx).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()); j.l = "1";
const bad = Buffer.from(JSON.stringify(j)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
console.log("tampered link valid?", decodeDeal(bad).valid);
// Cancel: advancing the nonce kills a signed deal.
svm.expireBlockhash();
const c = new Transaction().add(SystemProgram.nonceAdvance({ noncePubkey: nk.publicKey, authorizedPubkey: maker.publicKey })); c.feePayer = maker.publicKey; c.recentBlockhash = svm.latestBlockhash(); c.sign(maker); send(c);
tx.partialSign(taker); let dead = false; try { svm.expireBlockhash(); send(tx); } catch { dead = true; }
console.log("cancelled deal refused?", dead, "| deals ok", ok);
