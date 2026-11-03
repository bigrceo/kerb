import { markets } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await markets());
  } catch (e) {
    return Response.json({ error: (e as Error).message, coins: [] }, { status: 502 });
  }
}
