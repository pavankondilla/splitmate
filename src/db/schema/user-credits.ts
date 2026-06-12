import { pgTable, uuid, integer, timestamp, boolean, text } from "drizzle-orm/pg-core";
import { users } from "./users";
import { rooms } from "./rooms";
import { settlements } from "./settlements";

export const userCredits = pgTable("user_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  // Total credit generated from this overpayment (in paise)
  totalCredit: integer("total_credit").notNull(),
  // How much has been consumed by AUTO_CREDITED shares
  usedCredit: integer("used_credit").default(0).notNull(),
  // Which settlement caused the overpayment
  sourceSettlementId: uuid("source_settlement_id")
    .references(() => settlements.id)
    .notNull(),
  // The person who received the overpayment (owes this credit back)
  owedByUserId: uuid("owed_by_user_id")
    .references(() => users.id)
    .notNull(),
  isExhausted: boolean("is_exhausted").default(false).notNull(),
  // ACTIVE | PENDING_SETTLEMENT | SETTLED
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserCredit = typeof userCredits.$inferSelect;
export type NewUserCredit = typeof userCredits.$inferInsert;
