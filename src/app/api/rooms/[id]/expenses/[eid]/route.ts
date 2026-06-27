import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { deleteExpense, updateExpense } from "@/services/expense.service";
import { updateExpenseSchema } from "@/schemas/expense.schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  try {
    const user = await requireDbUser();
    const { eid } = await params;
    const body = await req.json();
    const data = updateExpenseSchema.parse(body);
    await updateExpense(eid, user.id, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

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
