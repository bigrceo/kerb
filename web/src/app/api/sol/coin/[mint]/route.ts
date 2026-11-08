import { coins } from "@/lib/sol/market";

export async function GET(_: Request, { params }: { params: Promise<{ mint: string }> }) {
  const { mint } = await params;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) return Response.json({ coin: null }, { status: 400 });
  const [c] = await coins([mint]).catch(() => []);
  return Response.json({ coin: c ?? null }, { headers: { "Cache-Control": "s-maxage=20, stale-while-revalidate=40" } });
}
