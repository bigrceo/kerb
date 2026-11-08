"use client";

import { useQuery } from "@tanstack/react-query";
import type { SolCoin } from "./market";

export function useSolCoin(mint?: string | null) {
  return useQuery({
    queryKey: ["solcoin", mint],
    enabled: !!mint && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint),
    refetchInterval: 30_000,
    queryFn: async () => ((await (await fetch(`/api/sol/coin/${mint}`)).json()) as { coin: SolCoin | null }).coin,
  });
}

export function useSolMarkets() {
  return useQuery({
    queryKey: ["solmarkets"],
    refetchInterval: 60_000,
    queryFn: async () => (await (await fetch("/api/sol/markets")).json()) as { coins: SolCoin[]; readAt: number },
  });
}
