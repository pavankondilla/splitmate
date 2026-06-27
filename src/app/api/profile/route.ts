import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUser } from "@/lib/auth";
import { apiError } from "@/lib/api";
import { updateUser } from "@/repositories/user.repository";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
});

export async function GET() {
  try {
    const user = await requireDbUser();
    return NextResponse.json({ id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireDbUser();
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const updated = await updateUser(user.id, { name: parsed.data.name });
    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error);
  }
}
