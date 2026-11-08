import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Mark } from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-84px)] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <span className="rise inline-block"><Mark size={72} /></span>
        <h1 style={{ animationDelay: "90ms" }} className="rise mt-6 text-6xl sm:text-8xl font-extrabold tracking-tighter">{BRAND.name}</h1>
        <p style={{ animationDelay: "180ms" }} className="rise mt-4 text-xl sm:text-2xl text-dim max-w-xl">{BRAND.tagline}</p>
        <p style={{ animationDelay: "270ms" }} className="rise mt-4 text-base text-dim max-w-lg">{BRAND.pitch}</p>
        <div style={{ animationDelay: "360ms" }} className="rise mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/deal/new" className="btn btn-a px-8">
            Make a deal
          </Link>
          <Link href="/docs" className="btn btn-o">
            How it works
          </Link>
        </div>
        {BRAND.tokenAddress && (
          <p style={{ animationDelay: "450ms" }} className="rise mt-10 text-sm text-dim">
            <span className="label mr-2">${BRAND.ticker}</span>
            <span className="num">{BRAND.tokenAddress}</span>
          </p>
        )}
      </div>
      <Kerbline />
    </div>
  );
}

/** A flat line that stays flat: the chart after a sale on the desk. */
function Kerbline() {
  return (
    <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-24" aria-hidden>
      <rect x="0" y="70" width="1200" height="50" fill="#f2c230" opacity="0.08" />
      <g className="kline">
        {Array.from({ length: 26 }).map((_, i) => (
          <rect key={i} x={i * 50} y="70" width="25" height="10" fill="#f2c230" />
        ))}
      </g>
    </svg>
  );
}
