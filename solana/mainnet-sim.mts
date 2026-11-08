// Mainnet dry run: a Kerb deal between two real wallets, simulated by a mainnet node against live state.
// Nothing is signed or sent. The nonce step is left out (it needs the maker's own nonce account; covered by deal-test.mts).
import { Connection, PublicKey, Transaction, VersionedTransaction } from "../web/node_modules/@solana/web3.js/lib/index.cjs.js";
import { dealInstructions, mintInfo, feeOf, TREASURY, type Terms } from "../web/src/lib/sol/deal.ts";

const c = new Connection("https://solana-rpc.publicnode.com", "confirmed");
const MINT = new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"); // BONK
// A large public wallet that holds BONK (an exchange hot wallet); only read, never signed for.
const seller: PublicKey | null = new PublicKey(process.argv[2] ?? "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9");
const buyer = TREASURY; // a real wallet with SOL is not needed for the token leg check; we look at the error if any
const { tokenProgram, decimals } = await mintInfo(c, MINT);
for (const side of ["ask"] as const) {
  const t: Terms = { side, maker: seller!, taker: buyer, mint: MINT, tokenProgram, decimals, amount: 1_000n * 10n ** BigInt(decimals), total: 1_000_000n, nonce: seller!, expiry: 0 };
  const ixs = dealInstructions(t).slice(1); // without the nonce advance
  const tx = new Transaction().add(...ixs);
  tx.feePayer = buyer;
  tx.recentBlockhash = (await c.getLatestBlockhash()).blockhash;
  const sim = await c.simulateTransaction(new VersionedTransaction(tx.compileMessage()), { sigVerify: false, replaceRecentBlockhash: true } as never);
  console.log("seller", seller!.toBase58(), "buyer", buyer.toBase58(), "fee", feeOf(t.total));
  console.log("err", JSON.stringify(sim.value.err));
  console.log((sim.value.logs ?? []).join("\n"));
}
