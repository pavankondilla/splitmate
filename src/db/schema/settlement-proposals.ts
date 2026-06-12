import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { rooms } from "./rooms";
import { userCredits } from "./user-credits";
import { settlements } from "./settlements";
import { expenseParticipants } from "./expense-participants";

export const settlementProposals = pgTable("settlement_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  // Who must pay (e.g. Aiverse)
  fromUserId: uuid("from_user_id")
    .references(() => users.id)
    .notNull(),
  // Who receives the payment (e.g. Pavan)
  toUserId: uuid("to_user_id")
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").notNull(),
  // Human-readable reason (e.g. "Charan applied ₹300 credit to groceries")
  reason: text("reason").notNull(),
  // Who triggered this by applying credit (e.g. Charan)
  triggeredByUserId: uuid("triggered_by_user_id")
    .references(() => users.id)
    .notNull(),
  // Which credit was consumed
  sourceCreditId: uuid("source_credit_id")
    .references(() => userCredits.id),
  // PROPOSED | CONFIRMED | DISMISSED
  status: text("status").notNull().default("PROPOSED"),
  // Set when a matching settlement confirms this proposal
  confirmedSettlementId: uuid("confirmed_settlement_id")
    .references(() => settlements.id),
  // The participant share this proposal originated from (for creditConfirmed update on confirm)
  participantId: uuid("participant_id")
    .references(() => expenseParticipants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SettlementProposal = typeof settlementProposals.$inferSelect;
export type NewSettlementProposal = typeof settlementProposals.$inferInsert;
