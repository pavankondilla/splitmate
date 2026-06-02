import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getRoomBalances, getPairwiseBalances } from "@/services/balance.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const [balances, pairwise] = await Promise.all([
      getRoomBalances(id, user.id),
      getPairwiseBalances(id, user.id),
    ]);
    return NextResponse.json({ balances, pairwise });
  } catch (error) {
    return apiError(error);
  }
}
