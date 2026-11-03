"use client";

import { useMarkets } from "@/lib/useMarkets";
import { CoinIcon } from "./CoinIcon";

/** A coin from the market list, or any address pasted in. */
export function CoinPicker({ value, onChange, extra }: { value: string; onChange: (a: string) => void; extra?: { address: string; symbol: string }[] }) {
  const m = useMarkets();
  const list = [...(extra ?? []), ...(m.data?.coins ?? []).slice(0, 40)];
  return (
    <div>
      <input className="input num" placeholder="0x… coin address" value={value} onChange={(e) => onChange(e.target.value.trim())} />
      <div className="flex gap-2 overflow-x-auto mt-2 pb-1">
        {list.slice(0, 14).map((c) => (
          <button
            key={c.address}
            onClick={() => onChange(c.address)}
            className={`btn btn-o h-9 text-xs shrink-0 ${value.toLowerCase() === c.address.toLowerCase() ? "border-accent! text-accent" : ""}`}
          >
            {"image" in c && <CoinIcon src={(c as { image?: string }).image} symbol={c.symbol} size={18} />}
            {c.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
