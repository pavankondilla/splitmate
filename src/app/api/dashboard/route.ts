import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getDashboard } from "@/services/dashboard.service";

export async function GET() {
  try {
    const user = await requireDbUser();
    const summary = await getDashboard(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    return apiError(error);
  }
}
