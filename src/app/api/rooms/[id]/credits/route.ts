import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getAvailableCredits, applyCredit } from "@/services/credit.service";
import { z } from "zod";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const credits = await getAvailableCredits(user.id, id);
    return NextResponse.json(credits);
  } catch (error) {
    return apiError(error);
  }
}

const applyCreditSchema = z.object({
  expenseParticipantId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const result = applyCreditSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 422 });
    }
    const applied = await applyCredit(user.id, id, result.data);
    return NextResponse.json(applied, { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
