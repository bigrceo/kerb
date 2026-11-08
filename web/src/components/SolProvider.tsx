"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";
import { RPC } from "@/lib/sol/deal";

/** Solana connection and wallets. Phantom, Solflare, Backpack and the rest register themselves (Wallet Standard). */
export function SolProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={[]} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
