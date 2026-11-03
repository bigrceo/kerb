"use client";

import { useQuery } from "@tanstack/react-query";
import type { Coin } from "./server/markets";
import type { Venue } from "./impact";

export type Markets = { coins: Coin[]; ethUsd: number | null; readAt: number; scanned?: { recent: number; graduated: number }; error?: string };

export function useMarkets() {
  return useQuery<Markets>({
    queryKey: ["markets"],
    refetchInterval: 60_000,
    queryFn: () => fetch("/api/markets").then((r) => r.json()),
  });
}

export type CoinDetail = {
  coin: Coin | null;
  ethUsd: number | null;
  readAt: number;
  pools: { pairAddress: string; dexId: string; labels?: string[]; url: string; quoteToken: { symbol: string }; liquidity?: { usd?: number }; priceUsd?: string }[];
};

export function useCoin(token?: string) {
  return useQuery<CoinDetail>({
    queryKey: ["coin", token],
    enabled: !!token,
    refetchInterval: 30_000,
    queryFn: () => fetch(`/api/coin/${token}`).then((r) => r.json()),
  });
}

export type { Coin, Venue };
