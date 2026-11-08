"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Simulator } from "@/components/Simulator";
import { CoinIcon } from "@/components/CoinIcon";
import { useMarkets } from "@/lib/useMarkets";
import { live, unitPrice, useFills, useOffers } from "@/lib/desk";
import { pct, price, usd, utc } from "@/lib/format";

const SORTS = [
  ["liq", "Pools"],
  ["mcap", "Mkt cap"],
  ["vol", "Volume 24h"],
] as const;

export default function Markets() {
  const m = useMarkets();
  const offers = useOffers();
  const fills = useFills();
  const [pick, setPick] = useState<string>();
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("liq");
  const [page, setPage] = useState(0);

  const coins = useMemo(() => {
    const c = [...(m.data?.coins ?? [])];
    const key = { liq: "liquidityUsd", mcap: "mcapUsd", vol: "volume24h" }[sort] as "liquidityUsd";
    return c.sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
  }, [m.data, sort]);
  const selected = coins.find((c) => c.address === pick) ?? coins[0];
  const open = (offers.data ?? []).filter(live);
  const bestBid = (token: string) => {
    const b = open.filter((o) => o.side === "bid" && o.token.toLowerCase() === token.toLowerCase());
    return b.length ? Math.max(...b.map(unitPrice)) : null;
  };
  const settled = (fills.data ?? []).reduce((a, f) => a + Number(f.eth) / 1e18, 0);
  const PER = 20;
  const rows = coins.slice(page * PER, page * PER + PER);

  return (
    <div className="wrap py-8 space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Big bag? Keep the chart flat.</h1>
        <p className="text-dim mt-2 max-w-2xl">
          Sell a whole bag to one buyer at your price, or bid for someone else&apos;s. It settles wallet to wallet in
          one transaction, so the pools, and the chart, never see it.
        </p>
      </div>

      <Simulator coin={selected} ethUsd={m.data?.ethUsd ?? null} readAt={m.data?.readAt} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile k="Open offers" v={String(open.length)} sub={`${open.filter((o) => o.side === "bid").length} bids, ${open.filter((o) => o.side === "ask").length} asks`} />
        <Tile k="Settled volume" v={`${settled.toLocaleString("en-US", { maximumFractionDigits: 5 })} SOL`} sub={`${fills.data?.length ?? 0} fills, on chain`} />
        <Tile k="Last fill" v={fills.data?.[0] ? `#${fills.data[0].id}` : "None yet"} sub={fills.data?.[0] ? `block ${fills.data[0].block}` : "the first fill shows here"} />
        <div className="card p-4 col-span-2 lg:col-span-1">
          <div className="flex justify-between">
            <span className="label">Newest offers</span>
            <Link href="/offers" className="text-xs link">All offers</Link>
          </div>
          {open.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {open.slice(-3).reverse().map((o) => (
                <li key={o.id} className="flex justify-between">
                  <Link href={`/offers/${o.id}`} className="hover:text-accent">
                    {o.side === "ask" ? "Sell" : "Buy"} {o.symbol}
                  </Link>
                  <span className="num text-dim">{(Number(o.total) / 1e18).toFixed(5)} SOL</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-dim mt-2">
              No open offers. <Link className="link" href="/offers/new">Post the first one</Link>
            </p>
          )}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-line">
          <h2 className="font-bold">Robinhood Chain coins</h2>
          <div className="seg ml-auto">
            {SORTS.map(([k, l]) => (
              <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="t min-w-[640px]">
            <thead>
              <tr>
                <th className="label">Coin</th>
                <th className="label">Price</th>
                <th className="label">24h</th>
                <th className="label">Pools</th>
                <th className="label">Best bid</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {m.isLoading && (
                <tr>
                  <td colSpan={6} className="text-dim">Reading Pons launches and pools on Robinhood Chain…</td>
                </tr>
              )}
              {rows.map((c) => {
                const bid = bestBid(c.address);
                return (
                  <tr
                    key={c.address}
                    onClick={() => setPick(c.address)}
                    className={`cursor-pointer hover:bg-white/[0.02] ${selected?.address === c.address ? "bg-white/[0.03]" : ""}`}
                  >
                    <td>
                      <span className="flex items-center gap-3">
                        <CoinIcon src={c.image} symbol={c.symbol} />
                        <span>
                          <span className="font-semibold block">{c.symbol}</span>
                          <span className="text-xs text-dim">{c.name} · {c.stage === "curve" ? "on curve" : "graduated"}</span>
                        </span>
                      </span>
                    </td>
                    <td className="num">{price(c.priceUsd)}</td>
                    <td className={`num ${(c.change24h ?? 0) >= 0 ? "text-up" : "text-down"}`}>{c.change24h == null ? "–" : pct(c.change24h / 100, 2)}</td>
                    <td className="num">{usd(c.liquidityUsd)}</td>
                    <td className="num text-dim">{bid ? `${bid.toPrecision(3)} SOL` : "–"}</td>
                    <td className="text-right">
                      <Link
                        href={`/offers/new?token=${c.address}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-o h-8 text-xs"
                      >
                        Offer
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4 border-t border-line text-xs text-dim">
          <span>
            {m.data?.error
              ? `Market read failed: ${m.data.error}`
              : m.data
                ? `Read ${utc(m.data.readAt)} from Pons and Uniswap on Robinhood Chain, names and 24h from DEX Screener. SOL ${usd(m.data.ethUsd)}.`
                : ""}
          </span>
          <span className="ml-auto flex gap-1">
            {Array.from({ length: Math.ceil(coins.length / PER) }).map((_, i) => (
              <button key={i} className={`btn btn-o h-8 px-3 ${page === i ? "text-accent" : ""}`} onClick={() => setPage(i)}>
                {i + 1}
              </button>
            ))}
          </span>
        </div>
      </section>
    </div>
  );
}

function Tile({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="label">{k}</div>
      <div className="text-2xl font-bold num mt-1">{v}</div>
      <div className="text-xs text-dim mt-1">{sub}</div>
    </div>
  );
}
