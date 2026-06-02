import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { addExpense, getRoomExpenses } from "@/services/expense.service";
import { addExpenseSchema } from "@/schemas/expense.schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const expenses = await getRoomExpenses(id, user.id);
    return NextResponse.json(expenses);
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
    const result = addExpenseSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 422 });
    }
    const expense = await addExpense(user.id, id, result.data);
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
