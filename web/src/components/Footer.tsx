"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { DESK, deskAddr, short } from "@/lib/chain";
import { Mark } from "./Logo";

export function Footer() {
  if (usePathname() === "/") return null;
  return (
    <footer className="border-t border-line mt-16">
      <div className="wrap py-8 flex flex-wrap gap-x-8 gap-y-3 items-center text-sm text-dim">
        <span className="inline-flex items-center gap-2 text-fg">
          <Mark size={16} /> {BRAND.name}
        </span>
        <span>
          Desk contract{" "}
          <a className="link num" href={deskAddr(DESK)} target="_blank" rel="noreferrer">
            {short(DESK)}
          </a>
        </span>
        <Link href="/docs" className="hover:text-fg">
          How it works
        </Link>
        <a href={BRAND.x} className="hover:text-fg" target="_blank" rel="noreferrer">
          X
        </a>
        <span className="ml-auto inline-flex items-center gap-4">
          <span className="label">Data</span>
          <img src="/brands/pons.jpg" alt="Pons" width={18} height={18} className="rounded-full" title="Pons" />
          <img src="/brands/uniswap.png" alt="Uniswap" width={18} height={18} title="Uniswap" />
          <img src="/brands/dexscreener.png" alt="DEX Screener" width={18} height={18} className="rounded" title="DEX Screener" />
          <img src="/brands/blockscout.png" alt="Blockscout" width={18} height={18} title="Blockscout" />
        </span>
      </div>
    </footer>
  );
}
