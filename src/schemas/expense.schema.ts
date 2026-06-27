import { z } from "zod";

export const addExpenseSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  amount: z.number().int("Amount must be an integer").positive("Amount must be positive"),
  category: z.enum(["RENT", "GROCERIES", "UTILITIES", "WIFI", "OTHER"]),
  splitType: z.enum(["EQUAL", "PERCENTAGE", "EXACT", "SHARES"]),
  paidBy: z.string().uuid("Invalid payer ID"),
  notes: z.string().max(1000).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  participantIds: z
    .array(z.string().uuid("Invalid participant ID"))
    .min(1, "At least one participant required"),
});

export type AddExpenseInput = z.infer<typeof addExpenseSchema>;

export const updateExpenseSchema = addExpenseSchema;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
