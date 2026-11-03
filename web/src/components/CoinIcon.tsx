/* eslint-disable @next/next/no-img-element */
export function CoinIcon({ src, symbol, size = 28 }: { src?: string; symbol: string; size?: number }) {
  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-full shrink-0" />;
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="rounded-full shrink-0 border border-line grid place-items-center font-bold text-dim"
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}
