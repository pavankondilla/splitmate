import { describe, it, expect } from "vitest";
import { addExpenseSchema } from "@/schemas/expense.schema";

const validExpense = {
  title: "Groceries",
  amount: 50000,
  category: "GROCERIES",
  splitType: "EQUAL",
  paidBy: "123e4567-e89b-12d3-a456-426614174000",
  expenseDate: "2026-06-01",
  participantIds: [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174001",
  ],
};

describe("addExpenseSchema", () => {
  it("accepts a valid expense", () => {
    expect(addExpenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("accepts optional notes field", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, notes: "Monthly groceries" }).success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, title: "" }).success).toBe(false);
  });

  it("rejects zero amount", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, amount: 0 }).success).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, amount: -100 }).success).toBe(false);
  });

  it("rejects float amount", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, amount: 100.5 }).success).toBe(false);
  });

  it("rejects invalid category", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, category: "FOOD" }).success).toBe(false);
  });

  it("rejects invalid split type", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, splitType: "HALF" }).success).toBe(false);
  });

  it("rejects invalid date format", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, expenseDate: "01-06-2026" }).success).toBe(false);
    expect(addExpenseSchema.safeParse({ ...validExpense, expenseDate: "2026/06/01" }).success).toBe(false);
  });

  it("rejects empty participantIds array", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, participantIds: [] }).success).toBe(false);
  });

  it("rejects invalid UUID in participantIds", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, participantIds: ["not-a-uuid"] }).success).toBe(false);
  });

  it("rejects non-UUID paidBy", () => {
    expect(addExpenseSchema.safeParse({ ...validExpense, paidBy: "alice" }).success).toBe(false);
  });
});
