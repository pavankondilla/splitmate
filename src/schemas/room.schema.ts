import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100, "Room name too long"),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().length(8, "Invite code must be 8 characters"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
