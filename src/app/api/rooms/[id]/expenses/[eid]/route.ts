import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { deleteExpense } from "@/services/expense.service";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const user = await requireDbUser();
    const { eid } = await params;
    await deleteExpense(eid, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
