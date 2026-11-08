import { trending } from "@/lib/sol/market";

export async function GET() {
  const list = await trending().catch(() => []);
  return Response.json({ coins: list, readAt: Date.now() }, { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" } });
}
