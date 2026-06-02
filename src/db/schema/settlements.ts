import { pgTable, uuid, integer, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";
import { rooms } from "./rooms";

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  payerId: uuid("payer_id")
    .references(() => users.id)
    .notNull(),
  payeeId: uuid("payee_id")
    .references(() => users.id)
    .notNull(),
  amount: integer("amount").notNull(),
  note: text("note"),
  settledAt: timestamp("settled_at").defaultNow().notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Settlement = typeof settlements.$inferSelect;
export type NewSettlement = typeof settlements.$inferInsert;
