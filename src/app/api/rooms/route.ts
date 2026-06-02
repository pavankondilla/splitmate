import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { createRoom, getUserRooms } from "@/services/room.service";
import { createRoomSchema } from "@/schemas/room.schema";

export async function GET() {
  try {
    const user = await requireDbUser();
    const rooms = await getUserRooms(user.id);
    return NextResponse.json(rooms);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const result = createRoomSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 422 });
    }
    const room = await createRoom(user.id, result.data.name);
    return NextResponse.json(room, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
