import { z } from "zod";

export const recordSettlementSchema = z.object({
  payerId: z.string().uuid("Invalid payer ID"),
  payeeId: z.string().uuid("Invalid payee ID"),
  amount: z.number().int("Amount must be an integer").positive("Amount must be positive"),
  note: z.string().max(500).optional(),
});

export type RecordSettlementInput = z.infer<typeof recordSettlementSchema>;
