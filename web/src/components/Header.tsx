"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Wordmark } from "./Logo";
import { short } from "@/lib/chain";
import { BRAND } from "@/lib/brand";

const ICON = {
  chart: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />,
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bag: <path d="M6 8h12l-1 13H7L6 8Zm3 0V6a3 3 0 0 1 6 0v2" />,
  whale: <path d="M17 20a5 5 0 1 0-10 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />,
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  book: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15ZM6.5 17A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5" />,
};
type Row = [keyof typeof ICON, string, string, string];
type Card = [string, string, string, "flat" | "bars"];

/** Mega menus: rows on the left, two picture cards on the right. */
const MENUS: Record<"trade", { label: string; rows: Row[]; cards: Card[] }> = {
  trade: {
    label: "Trade",
    rows: [
      ["plus", "Make a deal", "Sell a bag or bid for one, to one wallet, at your price.", "/deal/new"],
      ["list", "Open a deal link", "Got a Kerb link? Check the terms and settle it.", "/deal"],
      ["book", "How it works", "Three steps, in plain words. Your coins never leave your wallet early.", "/docs"],
    ],
    cards: [
      ["Sell off the chart", "One buyer, one transaction. The pool never sees it.", "/deal/new", "flat"],
      ["Sale simulator", "What the same bag would do to the chart in the pool.", "/markets", "bars"],
    ],
  },
};
const Ico = ({ k }: { k: keyof typeof ICON }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {ICON[k]}
  </svg>
);

/** Card pictures drawn in the brand colour: the flat kerb line, or bars falling into a pool. */
function Pic({ kind }: { kind: Card[3] }) {
  return (
    <svg viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="200" height="100" fill="#1b1d13" />
      {kind === "flat" ? (
        <>
          <path d="M0 62h200" stroke="#f2c230" strokeWidth="2" />
          {Array.from({ length: 10 }).map((_, i) => (
            <rect key={i} x={i * 20} y="70" width="10" height="5" fill="#f2c230" opacity=".9" />
          ))}
          <circle cx="150" cy="62" r="4" fill="#f2c230" />
        </>
      ) : (
        [70, 62, 55, 44, 30, 22, 16].map((h, i) => (
          <rect key={i} x={18 + i * 25} y={88 - h} width="14" height={h} rx="2" fill={i < 3 ? "#f2c230" : "#ff6b57"} opacity={1 - i * 0.08} />
        ))
      )}
    </svg>
  );
}

const Chev = () => (
  <svg className="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="m3 4.5 3 3 3-3" />
  </svg>
);

export function Connect() {
  const { publicKey, wallets, select, connect, disconnect, connecting, wallet } = useWallet();
  const [pick, setPick] = useState(false);
  useEffect(() => {
    if (wallet && !publicKey && !connecting) connect().catch(() => {});
  }, [wallet, publicKey, connecting, connect]);
  if (publicKey)
    return (
      <button className="btn btn-o num" onClick={() => disconnect()} title="Disconnect">
        {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
      </button>
    );
  const found = wallets.filter((w) => w.readyState === "Installed");
  return (
    <span className="relative inline-flex">
      <button className="btn btn-o" disabled={connecting} onClick={() => (found.length === 1 ? select(found[0].adapter.name) : setPick(!pick))}>
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {pick && (
        <span className="absolute right-0 top-full mt-2 z-50 card p-2 min-w-48 flex flex-col">
          {found.length ? (
            found.map((w) => (
              <button key={w.adapter.name} className="text-left px-3 py-2 rounded hover:bg-panel flex items-center gap-2" onClick={() => (select(w.adapter.name), setPick(false))}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.adapter.icon} alt="" width={18} height={18} />
                {w.adapter.name}
              </button>
            ))
          ) : (
            <a className="px-3 py-2 link" href="https://phantom.com" target="_blank" rel="noreferrer">Install Phantom</a>
          )}
        </span>
      )}
    </span>
  );
}

export function Header() {
  const path = usePathname();
  const [menu, setMenu] = useState<keyof typeof MENUS | null>(null);
  const [mobile, setMobile] = useState(false);
  const [glass, setGlass] = useState(false);
  const shut = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Glass once the page leaves the top; menus close on navigation and Escape.
  useEffect(() => {
    const on = () => setGlass(scrollY > 12);
    on();
    addEventListener("scroll", on, { passive: true });
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    addEventListener("keydown", esc);
    return () => (removeEventListener("scroll", on), removeEventListener("keydown", esc));
  }, []);
  useEffect(() => (setMenu(null), setMobile(false)), [path]);

  const open = (k: keyof typeof MENUS | null) => (clearTimeout(shut.current), setMenu(k));
  const hover = () => matchMedia("(hover: hover)").matches;
  // Markets and Docs have their own top links, so they do not light up the Data menu too.
  const inMenu = (k: keyof typeof MENUS) =>
    !path.startsWith("/docs") && !path.startsWith("/markets") && MENUS[k].rows.some((r) => path.startsWith(r[3]));

  return (
    <>
      <nav
        id="nav"
        className={[glass && "glass", menu && "open", mobile && "mopen"].filter(Boolean).join(" ")}
        onMouseLeave={() => (shut.current = setTimeout(() => setMenu(null), 180))}
      >
        <div className="nwrap">
          <div className="bar">
            <Link href="/" aria-label="Home" onMouseEnter={() => open(null)}>
              <Wordmark />
            </Link>
            <div className="links">
              {(Object.keys(MENUS) as (keyof typeof MENUS)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={menu === k || (!menu && inMenu(k)) ? "on" : ""}
                  onMouseEnter={() => hover() && open(k)}
                  onClick={() => open(hover() || menu !== k ? k : null)}
                  aria-expanded={menu === k}
                >
                  {MENUS[k].label}
                  <Chev />
                </button>
              ))}
              <Link href="/markets" className={path.startsWith("/markets") ? "on" : ""} onMouseEnter={() => open(null)}>
                Markets
              </Link>
              <Link href="/docs" className={path.startsWith("/docs") ? "on" : ""} onMouseEnter={() => open(null)}>
                Docs
              </Link>
            </div>
            <div className="navr">
              {BRAND.tokenAddress && (
                <button type="button" className="ca" title="Copy contract address" onClick={() => navigator.clipboard?.writeText(BRAND.tokenAddress)}>
                  ${BRAND.ticker} <span>{short(BRAND.tokenAddress)}</span>
                </button>
              )}
              <a className="xb" href={BRAND.github} aria-label="Source code on GitHub" title="Open source on GitHub" target="_blank" rel="noreferrer">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
                </svg>
              </a>
              <a className="xb" href={BRAND.x} aria-label="X">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-7-6.1 7H1.7l8.1-9.3L1 2h7l4.8 6.4L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
                </svg>
              </a>
              <span className="hidden md:inline-flex">
                <Connect />
              </span>
              <Link href="/deal/new" className="btn btn-a hidden sm:inline-flex">
                Make a deal
              </Link>
              <button className="mbtn" type="button" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
                <i />
                <i />
              </button>
            </div>
          </div>
          {(Object.keys(MENUS) as (keyof typeof MENUS)[]).map((k) => (
            <div key={k} className={`mega${menu === k ? " show" : ""}`} inert={menu !== k}>
              <div className="mega-in">
                <div className="mrows">
                  {MENUS[k].rows.map(([i, t, d, h]) => (
                    <Link key={h} className="mrow" href={h}>
                      <span className="mico">
                        <Ico k={i} />
                      </span>
                      <span>
                        <b>{t}</b>
                        <small>{d}</small>
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="mcards">
                  {MENUS[k].cards.map(([t, d, h, pic]) => (
                    <Link key={t} className="mcard" href={h}>
                      <span className="mimg">
                        <Pic kind={pic} />
                      </span>
                      <span className="mtxt">
                        <b>{t}</b>
                        <small>{d}</small>
                        <i>↗</i>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <div className="mlist" inert={!mobile}>
            <div>
              {[...MENUS.trade.rows, ["chart", "Markets", "", "/markets"] as Row].map(([, t, , h]) => (
                <Link key={h} href={h}>
                  {t}
                  <span>↗</span>
                </Link>
              ))}
              <div className="pt-3 md:hidden">
                <Connect />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
