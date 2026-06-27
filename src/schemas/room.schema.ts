import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100, "Room name too long"),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().length(8, "Invite code must be 8 characters"),
});

export const updateRoomSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rename"),
    name: z.string().min(1, "Room name is required").max(100, "Room name too long"),
  }),
  z.object({
    action: z.literal("regenerate_code"),
  }),
]);

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
