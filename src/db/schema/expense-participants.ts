import { pgTable, uuid, integer, boolean, decimal } from "drizzle-orm/pg-core";
import { users } from "./users";
import { expenses } from "./expenses";

export const expenseParticipants = pgTable("expense_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id")
    .references(() => expenses.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  shareAmount: integer("share_amount").notNull(),
  sharePercentage: decimal("share_percentage", { precision: 5, scale: 2 }),
  isSettled: boolean("is_settled").default(false).notNull(),
  // Amount covered by user's credit pool (0 = none, >0 = AUTO_CREDITED)
  creditApplied: integer("credit_applied").default(0).notNull(),
});

export type ExpenseParticipant = typeof expenseParticipants.$inferSelect;
export type NewExpenseParticipant = typeof expenseParticipants.$inferInsert;
