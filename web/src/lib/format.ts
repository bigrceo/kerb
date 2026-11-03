export const usd = (n: number | null | undefined, max = 2) => {
  if (n == null || !isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `$${(n / 1e3).toFixed(1)}K`;
  if (a >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: max })}`;
  return price(n);
};

/** Small prices keep their significant digits: $0.0₅2819. */
export const price = (n: number | null | undefined) => {
  if (n == null || !isFinite(n) || n === 0) return "–";
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  const s = n.toFixed(20).split(".")[1];
  const zeros = s.match(/^0*/)![0].length;
  const digits = s.slice(zeros, zeros + 4);
  if (zeros < 3) return `$0.${"0".repeat(zeros)}${digits}`;
  const sub = String(zeros).split("").map((d) => "₀₁₂₃₄₅₆₇₈₉"[+d]).join("");
  return `$0.0${sub}${digits}`;
};

export const pct = (f: number | null | undefined, digits = 1) =>
  f == null || !isFinite(f) ? "–" : `${f > 0 ? "+" : f < 0 ? "−" : ""}${Math.abs(f * 100).toFixed(digits)}%`;

export const eth = (n: number | null | undefined, digits = 4) =>
  n == null || !isFinite(n) ? "–" : `${n.toLocaleString("en-US", { maximumFractionDigits: digits })} ETH`;

export const amount = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
};

export const ago = (ms: number) => {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

export const utc = (ms: number) => new Date(ms).toISOString().slice(11, 19) + " UTC";

export const until = (ms: number) => ago(2 * Date.now() - ms).replace(" ago", "");
