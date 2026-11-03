import { isAddress } from "viem";
import { coin } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isAddress(token)) return Response.json({ error: "not an address" }, { status: 400 });
  try {
    return Response.json(await coin(token));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
