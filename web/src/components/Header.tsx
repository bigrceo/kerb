"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wordmark } from "./Logo";
import { DESK_CHAIN, ON_TESTNET, short } from "@/lib/chain";

const NAV = [
  ["/markets", "Markets"],
  ["/pools", "Pools"],
  ["/offers", "Offers"],
  ["/positions", "Positions"],
  ["/wallets", "Wallets"],
  ["/history", "History"],
  ["/docs", "Docs"],
] as const;

export function Connect() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  if (isConnected && chainId !== DESK_CHAIN.id)
    return (
      <button className="btn btn-o" onClick={() => switchChain({ chainId: DESK_CHAIN.id })}>
        Switch to {ON_TESTNET ? "testnet" : DESK_CHAIN.name}
      </button>
    );
  if (isConnected)
    return (
      <button className="btn btn-o num" onClick={() => disconnect()} title="Disconnect">
        {short(address)}
      </button>
    );
  return (
    <button
      className="btn btn-o"
      disabled={isPending}
      onClick={() => connectors[0] && connect({ connector: connectors[0], chainId: DESK_CHAIN.id })}
    >
      Connect wallet
    </button>
  );
}

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/") return null;
  return (
    <header className="border-b border-line sticky top-0 z-20 bg-ink/95 backdrop-blur">
      <div className="wrap flex items-center gap-6 h-16">
        <Link href="/" aria-label="Home">
          <Wordmark />
        </Link>
        <nav className="hidden lg:flex gap-5 text-sm">
          {NAV.map(([h, l]) => (
            <Link key={h} href={h} className={path.startsWith(h) ? "text-fg font-semibold" : "text-dim hover:text-fg"}>
              {l}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <Connect />
          </span>
          <Link href="/offers/new" className="btn btn-a">
            Make offer
          </Link>
          <button className="btn btn-o lg:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
            Menu
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden border-t border-line wrap py-3 grid grid-cols-2 gap-2">
          {NAV.map(([h, l]) => (
            <Link key={h} href={h} onClick={() => setOpen(false)} className="py-2 text-dim hover:text-fg">
              {l}
            </Link>
          ))}
          <div className="col-span-2 sm:hidden pt-2">
            <Connect />
          </div>
        </nav>
      )}
      {ON_TESTNET && (
        <div className="border-t border-line">
          <p className="wrap py-2 text-xs text-dim">
            <span className="label text-accent mr-2">Testnet desk</span>
            Offers settle on Robinhood Chain Testnet ({DESK_CHAIN.id}) until the desk is on mainnet. Prices and pools are
            read live from mainnet.
          </p>
        </div>
      )}
    </header>
  );
}
