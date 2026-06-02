import { pgTable, uuid, varchar, integer, text, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { rooms } from "./rooms";

export const expenseCategoryEnum = pgEnum("expense_category", [
  "RENT",
  "GROCERIES",
  "UTILITIES",
  "WIFI",
  "OTHER",
]);

export const splitTypeEnum = pgEnum("split_type", [
  "EQUAL",
  "PERCENTAGE",
  "EXACT",
  "SHARES",
]);

export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: integer("amount").notNull(),
  category: expenseCategoryEnum("category").default("OTHER").notNull(),
  splitType: splitTypeEnum("split_type").default("EQUAL").notNull(),
  paidBy: uuid("paid_by")
    .references(() => users.id)
    .notNull(),
  notes: text("notes"),
  expenseDate: date("expense_date").notNull(),
  deletedAt: timestamp("deleted_at"),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
