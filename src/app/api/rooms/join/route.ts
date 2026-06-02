import { NextResponse } from "next/server";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { joinRoomByCode } from "@/services/room.service";
import { joinRoomSchema } from "@/schemas/room.schema";

export async function POST(req: Request) {
  try {
    const user = await requireDbUser();
    const result = joinRoomSchema.safeParse(await req.json());
    if (!result.success) {
      return NextResponse.json({ error: "Validation failed", issues: result.error.issues }, { status: 422 });
    }
    const member = await joinRoomByCode(user.id, result.data.inviteCode);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
