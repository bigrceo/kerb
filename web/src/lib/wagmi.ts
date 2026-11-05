"use client";

import { createConfig, fallback, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "wagmi/connectors";
import { DESK_CHAIN } from "./chain";

export const deskChain = defineChain({
  id: DESK_CHAIN.id,
  name: DESK_CHAIN.name,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [DESK_CHAIN.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: DESK_CHAIN.explorer } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const wagmiConfig = createConfig({
  chains: [deskChain],
  connectors: [injected({ shimDisconnect: true })],
  // The chain's own RPC first: it serves event logs from any block, which the public mirror refuses
  // without an archive token. The mirror takes over if the official one rate-limits.
  transports: { [deskChain.id]: fallback([http(DESK_CHAIN.rpc), http(DESK_CHAIN.readRpc)]) } as Record<number, ReturnType<typeof fallback>>,
  ssr: true,
});
