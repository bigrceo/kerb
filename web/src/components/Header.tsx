"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { Wordmark } from "./Logo";
import { DESK_CHAIN, ON_TESTNET, short } from "@/lib/chain";
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
const MENUS: Record<"trade" | "data", { label: string; rows: Row[]; cards: Card[] }> = {
  trade: {
    label: "Trade",
    rows: [
      ["list", "Offers", "Every open ask and bid on the desk.", "/offers"],
      ["plus", "Make offer", "Sell a bag or bid for one, at your price.", "/offers/new"],
      ["bag", "Positions", "Your offers, fills and reclaims.", "/positions"],
      ["whale", "Wallets", "Biggest holders of any coin. Bid them privately.", "/wallets"],
    ],
    cards: [
      ["Sell off the chart", "One buyer, one transaction. The pool never sees it.", "/offers/new", "flat"],
      ["Sale simulator", "What the same bag would get in the pools.", "/markets", "bars"],
    ],
  },
  data: {
    label: "Data",
    rows: [
      ["chart", "Markets", "Solana coins, read on chain.", "/markets"],
      ["drop", "Pools", "pump.fun curves and PumpSwap depth.", "/pools"],
      ["clock", "History", "Every fill, from the contract's events.", "/history"],
      ["book", "Docs", "How the desk settles, fees, security.", "/docs"],
    ],
    cards: [
      ["Chart impact", "How far a sale would push the price.", "/markets", "bars"],
      ["Open contract", "Escrow goes to a buyer on your terms, or back to you.", "/docs", "flat"],
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
    !path.startsWith("/markets") && !path.startsWith("/docs") && MENUS[k].rows.some((r) => path.startsWith(r[3]));

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
              <a className="xb" href={BRAND.x} aria-label="X">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                  <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-7-6.1 7H1.7l8.1-9.3L1 2h7l4.8 6.4L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
                </svg>
              </a>
              <span className="hidden md:inline-flex">
                <Connect />
              </span>
              <Link href="/offers/new" className="btn btn-a hidden sm:inline-flex">
                Make offer
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
              {[...MENUS.trade.rows, ...MENUS.data.rows].map(([, t, , h]) => (
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
