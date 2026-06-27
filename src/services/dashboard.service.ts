import * as roomRepo from "@/repositories/room.repository";
import * as expenseRepo from "@/repositories/expense.repository";
import * as settlementRepo from "@/repositories/settlement.repository";
import * as creditRepo from "@/repositories/credit.repository";
import * as proposalRepo from "@/repositories/proposal.repository";
import { computeNetBalance } from "@/lib/balance";

export interface DashboardSummary {
  totalNetBalance: number;
  rooms: Array<{
    id: string;
    name: string;
    currency: string;
    memberCount: number;
    myNetBalance: number;
    expenseCount: number;
  }>;
}

export async function getDashboard(userId: string): Promise<DashboardSummary> {
  const roomRows = await roomRepo.findRoomsByUserId(userId);
  const rooms = roomRows.map((r) => r.room);

  let totalNetBalance = 0;

  const roomSummaries = await Promise.all(
    rooms.map(async (room) => {
      const [members, expenses, settlements, credits, confirmedProposals] = await Promise.all([
        roomRepo.findRoomMembers(room.id),
        expenseRepo.findExpensesByRoomId(room.id),
        settlementRepo.findSettlementsByRoomId(room.id),
        creditRepo.findAllCreditsByRoom(room.id),
        proposalRepo.findConfirmedProposalsByRoom(room.id),
      ]);

      const expenseIds = expenses.map((e) => e.id);
      const participants = await expenseRepo.findParticipantsByExpenseIds(expenseIds);

      const { netBalance } = computeNetBalance(
        userId,
        expenses,
        participants,
        settlements,
        credits,
        confirmedProposals
      );
      totalNetBalance += netBalance;

      return {
        id: room.id,
        name: room.name,
        currency: room.currency,
        memberCount: members.length,
        myNetBalance: netBalance,
        expenseCount: expenses.length,
      };
    })
  );

  return { totalNetBalance, rooms: roomSummaries };
}
