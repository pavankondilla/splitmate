import { requireDbUser } from "@/lib/auth";
import { removeMember } from "@/services/room.service";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: roomId, memberId } = await params;
    const user = await requireDbUser();

    await removeMember(roomId, memberId, user.id);

    return Response.json({ success: true });
  } catch (err) {
    if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
    if (err instanceof ForbiddenError) return Response.json({ error: err.message }, { status: 403 });
    if (err instanceof ConflictError) return Response.json({ error: err.message }, { status: 409 });
    throw err;
  }
}
