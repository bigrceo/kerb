import { isAddress } from "viem";
import { holders } from "@/lib/server/markets";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isAddress(token)) return Response.json({ error: "not an address" }, { status: 400 });
  return Response.json({ holders: await holders(token).catch(() => []) });
}
