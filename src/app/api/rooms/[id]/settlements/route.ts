import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { recordSettlement, getRoomSettlements } from "@/services/settlement.service";
import { recordSettlementSchema } from "@/schemas/settlement.schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const settlements = await getRoomSettlements(id, user.id);
    return NextResponse.json(settlements);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const result = recordSettlementSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 422 });
    }
    const settlement = await recordSettlement(user.id, id, result.data);
    return NextResponse.json(settlement, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
