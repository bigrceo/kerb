"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useWriteContract } from "wagmi";
import { useState } from "react";
import { formatUnits, parseAbi } from "viem";
import abi from "./desk-abi.json";
import { DESK, DESK_FROM_BLOCK } from "./chain";

export const deskAbi = abi as typeof abi;
export const erc20 = parseAbi([
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

export type Offer = {
  id: number;
  maker: `0x${string}`;
  token: `0x${string}`;
  taker: `0x${string}`;
  expiry: number;
  side: "ask" | "bid";
  open: boolean;
  amount: bigint;
  total: bigint;
  filled: bigint;
  minFill: bigint;
  symbol: string;
  decimals: number;
};

type Raw = Omit<Offer, "id" | "side" | "expiry" | "symbol" | "decimals"> & { side: number; expiry: bigint };

export const live = (o: Offer) => o.open && o.expiry * 1000 > Date.now();
export const left = (o: Offer) => o.amount - o.filled;
/** ETH per whole token. */
export const unitPrice = (o: Offer) => Number(o.total) / 1e18 / (Number(o.amount) / 10 ** o.decimals);
export const tokens = (o: Offer, v: bigint) => Number(formatUnits(v, o.decimals));

/** Every offer on the desk, with each token's symbol. */
export function useOffers() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["offers"],
    refetchInterval: 15_000,
    enabled: !!client,
    queryFn: async () => {
      const n = (await client!.readContract({ address: DESK, abi: deskAbi, functionName: "offerCount" })) as bigint;
      if (n === 0n) return [] as Offer[];
      const raw = (await client!.readContract({
        address: DESK,
        abi: deskAbi,
        functionName: "offers",
        args: [0n, n],
      })) as Raw[];
      const toks = [...new Set(raw.map((r) => r.token))];
      const meta = await Promise.all(
        toks.map(async (t) => {
          const [s, d] = await Promise.all([
            client!.readContract({ address: t, abi: erc20, functionName: "symbol" }).catch(() => "?"),
            client!.readContract({ address: t, abi: erc20, functionName: "decimals" }).catch(() => 18),
          ]);
          return [t, { symbol: s as string, decimals: Number(d) }] as const;
        }),
      );
      const M = new Map(meta);
      return raw.map((r, i) => ({
        ...r,
        id: i,
        side: r.side === 0 ? "ask" : "bid",
        expiry: Number(r.expiry),
        ...M.get(r.token)!,
      })) as Offer[];
    },
  });
}

export type Fill = { id: number; taker: string; tokens: bigint; eth: bigint; fee: bigint; tx: string; block: bigint };

export function useFills() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["fills"],
    refetchInterval: 20_000,
    enabled: !!client,
    queryFn: async () => {
      const latest = await client!.getBlockNumber();
      const out: Fill[] = [];
      const STEP = 500_000n;
      for (let from = DESK_FROM_BLOCK; from <= latest; from += STEP) {
        const to = from + STEP - 1n > latest ? latest : from + STEP - 1n;
        const logs = await client!.getContractEvents({ address: DESK, abi: deskAbi, eventName: "OfferFilled", fromBlock: from, toBlock: to });
        for (const l of logs as unknown as { args: { id: bigint; taker: string; tokens: bigint; eth: bigint; fee: bigint }; transactionHash: string; blockNumber: bigint }[])
          out.push({ id: Number(l.args.id), taker: l.args.taker, tokens: l.args.tokens, eth: l.args.eth, fee: l.args.fee, tx: l.transactionHash, block: l.blockNumber });
      }
      return out.reverse();
    },
  });
}

/** Sends a transaction, waits for the receipt, says where it stands. */
export function useTx() {
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const [state, setState] = useState<{ busy: boolean; msg?: string; hash?: string; ok?: boolean }>({ busy: false });
  async function send(args: { address: `0x${string}`; abi: unknown; functionName: string; args?: readonly unknown[]; value?: bigint }, done = "Done") {
    setState({ busy: true, msg: "Confirm in your wallet" });
    try {
      const hash = await writeContractAsync(args as never);
      setState({ busy: true, msg: "Settling", hash });
      const r = await client!.waitForTransactionReceipt({ hash });
      const ok = r.status === "success";
      setState({ busy: false, msg: ok ? done : "Reverted", hash, ok });
      return ok ? hash : undefined;
    } catch (e) {
      setState({ busy: false, msg: (e as { shortMessage?: string }).shortMessage ?? "Failed", ok: false });
    }
  }
  return { ...state, send };
}
