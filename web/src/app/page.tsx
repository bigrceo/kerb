import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Mark } from "@/components/Logo";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16">
        <Mark size={72} />
        <h1 className="mt-6 text-6xl sm:text-8xl font-extrabold tracking-tighter">{BRAND.name}</h1>
        <p className="mt-4 text-xl sm:text-2xl text-dim max-w-xl">{BRAND.tagline}</p>
        <p className="mt-4 text-base text-dim max-w-lg">{BRAND.pitch}</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link href="/markets" className="btn btn-a px-8">
            Open the desk
          </Link>
          <Link href="/docs" className="btn btn-o">
            How it works
          </Link>
        </div>
        <nav className="mt-8 flex gap-6 text-sm text-dim">
          <Link href="/offers" className="hover:text-fg">Offers</Link>
          <Link href="/offers/new" className="hover:text-fg">Make offer</Link>
          <a href={BRAND.x} className="hover:text-fg">X</a>
        </nav>
        <p className="mt-10 text-sm text-dim">
          <span className="label mr-2">${BRAND.ticker}</span>
          {BRAND.tokenAddress ? <span className="num">{BRAND.tokenAddress}</span> : "Not live yet"}
        </p>
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
      {Array.from({ length: 24 }).map((_, i) => (
        <rect key={i} x={i * 50} y="70" width="25" height="10" fill="#f2c230" />
      ))}
    </svg>
  );
}
