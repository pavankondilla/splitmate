import { describe, it, expect } from "vitest";
import { recordSettlementSchema } from "@/schemas/settlement.schema";

const validSettlement = {
  payerId: "123e4567-e89b-12d3-a456-426614174000",
  payeeId: "223e4567-e89b-12d3-a456-426614174001",
  amount: 10000,
};

describe("recordSettlementSchema", () => {
  it("accepts a valid settlement", () => {
    expect(recordSettlementSchema.safeParse(validSettlement).success).toBe(true);
  });

  it("accepts optional note", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, note: "Rent split" }).success).toBe(true);
  });

  it("rejects non-UUID payerId", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, payerId: "bob" }).success).toBe(false);
  });

  it("rejects non-UUID payeeId", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, payeeId: "alice" }).success).toBe(false);
  });

  it("rejects zero amount", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, amount: 0 }).success).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, amount: -500 }).success).toBe(false);
  });

  it("rejects float amount", () => {
    expect(recordSettlementSchema.safeParse({ ...validSettlement, amount: 99.9 }).success).toBe(false);
  });
});
