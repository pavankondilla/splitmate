import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getRoomDetail } from "@/services/room.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const detail = await getRoomDetail(id, user.id);
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error);
  }
}
