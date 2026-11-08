"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { Mark } from "./Logo";

export function Footer() {
  if (usePathname() === "/") return null;
  return (
    <footer className="border-t border-line mt-16">
      <div className="wrap py-8 flex flex-wrap gap-x-8 gap-y-3 items-center text-sm text-dim">
        <span className="inline-flex items-center gap-2 text-fg">
          <Mark size={16} /> {BRAND.name}
        </span>
        <Link href="/deal/new" className="hover:text-fg">
          Make a deal
        </Link>
        <Link href="/docs" className="hover:text-fg">
          How it works
        </Link>
        <a href={BRAND.x} className="hover:text-fg" target="_blank" rel="noreferrer">
          X
        </a>
        <span className="ml-auto inline-flex items-center gap-4">
        </span>
      </div>
    </footer>
  );
}
