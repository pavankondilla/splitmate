import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { getRoomDetail, deleteRoom, renameRoom, regenerateInviteCode } from "@/services/room.service";
import { updateRoomSchema } from "@/schemas/room.schema";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    const body = await req.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    if (parsed.data.action === "rename") {
      const updated = await renameRoom(id, user.id, parsed.data.name);
      return NextResponse.json(updated);
    }

    const updated = await regenerateInviteCode(id, user.id);
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireDbUser();
    const { id } = await params;
    await deleteRoom(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
