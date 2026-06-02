import { describe, it, expect } from "vitest";
import { createRoomSchema, joinRoomSchema } from "@/schemas/room.schema";

describe("createRoomSchema", () => {
  it("accepts a valid room name", () => {
    expect(createRoomSchema.safeParse({ name: "Flat 4B" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createRoomSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 100 characters", () => {
    expect(createRoomSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects missing name field", () => {
    expect(createRoomSchema.safeParse({}).success).toBe(false);
  });
});

describe("joinRoomSchema", () => {
  it("accepts a valid 8-char invite code", () => {
    expect(joinRoomSchema.safeParse({ inviteCode: "ABCD1234" }).success).toBe(true);
  });

  it("rejects a code shorter than 8 characters", () => {
    expect(joinRoomSchema.safeParse({ inviteCode: "ABC123" }).success).toBe(false);
  });

  it("rejects a code longer than 8 characters", () => {
    expect(joinRoomSchema.safeParse({ inviteCode: "ABCD12345" }).success).toBe(false);
  });

  it("rejects missing inviteCode field", () => {
    expect(joinRoomSchema.safeParse({}).success).toBe(false);
  });
});
