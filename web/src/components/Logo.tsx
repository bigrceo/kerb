import { BRAND } from "@/lib/brand";

export function Mark({ size = 24, color = BRAND.colors.accent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d={BRAND.markPath} fill={color} />
    </svg>
  );
}

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size} />
      <span style={{ fontSize: size * 0.95 }} className="font-bold tracking-tight">
        {BRAND.name}
      </span>
    </span>
  );
}
