import { describe, it, expect } from "vitest";
import { computeNetBalance } from "@/lib/balance";

const alice = "user-alice";
const bob = "user-bob";
const charlie = "user-charlie";

describe("computeNetBalance", () => {
  it("returns zero when there are no expenses or settlements", () => {
    const result = computeNetBalance(alice, [], [], []);
    expect(result).toEqual({ netBalance: 0, totalOwedToUser: 0, totalUserOwes: 0 });
  });

  it("payer has positive balance when others owe them", () => {
    const expenses = [{ id: "exp-1", paidBy: alice }];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: charlie, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
    ];
    const result = computeNetBalance(alice, expenses, participants, []);
    expect(result.totalOwedToUser).toBe(200); // bob + charlie owe alice
    expect(result.totalUserOwes).toBe(0);
    expect(result.netBalance).toBe(200);
  });

  it("participant has negative balance when they owe the payer", () => {
    const expenses = [{ id: "exp-1", paidBy: alice }];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
    ];
    const result = computeNetBalance(bob, expenses, participants, []);
    expect(result.totalUserOwes).toBe(100);
    expect(result.netBalance).toBe(-100);
  });

  it("settlement reduces debt correctly", () => {
    const expenses = [{ id: "exp-1", paidBy: alice }];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
    ];
    const settlements = [{ payerId: bob, payeeId: alice, amount: 100 }];

    const aliceResult = computeNetBalance(alice, expenses, participants, settlements);
    expect(aliceResult.netBalance).toBe(0); // bob paid alice back

    const bobResult = computeNetBalance(bob, expenses, participants, settlements);
    expect(bobResult.netBalance).toBe(0); // bob settled his debt
  });

  it("partial settlement leaves remaining balance", () => {
    const expenses = [{ id: "exp-1", paidBy: alice }];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
    ];
    const settlements = [{ payerId: bob, payeeId: alice, amount: 60 }];

    const aliceResult = computeNetBalance(alice, expenses, participants, settlements);
    expect(aliceResult.netBalance).toBe(40); // still owed 40

    const bobResult = computeNetBalance(bob, expenses, participants, settlements);
    expect(bobResult.netBalance).toBe(-40); // still owes 40
  });

  it("handles mutual expenses correctly", () => {
    // Alice pays 200, splits with Bob → Bob owes Alice 100
    // Bob pays 150, splits with Alice → Alice owes Bob 75
    // Net: Alice is owed 100 - 75 = 25
    const expenses = [
      { id: "exp-1", paidBy: alice },
      { id: "exp-2", paidBy: bob },
    ];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-2", userId: alice, shareAmount: 75, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-2", userId: bob, shareAmount: 75, creditApplied: 0, creditConfirmed: false },
    ];
    const aliceResult = computeNetBalance(alice, expenses, participants, []);
    expect(aliceResult.netBalance).toBe(25);

    const bobResult = computeNetBalance(bob, expenses, participants, []);
    expect(bobResult.netBalance).toBe(-25);
  });

  it("net balances across all members sum to zero", () => {
    const expenses = [
      { id: "exp-1", paidBy: alice },
      { id: "exp-2", paidBy: bob },
    ];
    const participants = [
      { expenseId: "exp-1", userId: alice, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: bob, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-1", userId: charlie, shareAmount: 100, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-2", userId: alice, shareAmount: 50, creditApplied: 0, creditConfirmed: false },
      { expenseId: "exp-2", userId: bob, shareAmount: 50, creditApplied: 0, creditConfirmed: false },
    ];

    const nets = [alice, bob, charlie].map(
      (u) => computeNetBalance(u, expenses, participants, []).netBalance
    );
    expect(nets.reduce((s, n) => s + n, 0)).toBe(0);
  });
});

// Phase 19 regression: the proposal-path credit flow must not double-count.
// Scenario (amounts in paise): Aiverse pays ₹9,000 rent split 3 ways.
// Charan settles ₹4,000 (₹1,000 over → credit owed by Aiverse).
// Pavan settles ₹3,000 exactly. Pavan then pays ₹900 groceries split 3 ways.
// Charan applies ₹300 of his credit to his grocery share → proposal:
// Aiverse should pay Pavan ₹300 on Charan's behalf.
describe("computeNetBalance — proposal-path credit (3 members)", () => {
  const aiverse = "user-aiverse";
  const charan = "user-charan";
  const pavan = "user-pavan";

  const expenses = [
    { id: "exp-rent", paidBy: aiverse },
    { id: "exp-groceries", paidBy: pavan },
  ];

  const baseSettlements = [
    { payerId: charan, payeeId: aiverse, amount: 400000 },
    { payerId: pavan, payeeId: aiverse, amount: 300000 },
  ];

  const rentShares = [
    { id: "p-rent-a", expenseId: "exp-rent", userId: aiverse, shareAmount: 300000, creditApplied: 0, creditConfirmed: false },
    { id: "p-rent-c", expenseId: "exp-rent", userId: charan, shareAmount: 300000, creditApplied: 0, creditConfirmed: false },
    { id: "p-rent-p", expenseId: "exp-rent", userId: pavan, shareAmount: 300000, creditApplied: 0, creditConfirmed: false },
  ];

  it("before proposal confirmation: pending credit changes nothing", () => {
    const participants = [
      ...rentShares,
      { id: "p-gro-a", expenseId: "exp-groceries", userId: aiverse, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
      { id: "p-gro-c", expenseId: "exp-groceries", userId: charan, shareAmount: 30000, creditApplied: 30000, creditConfirmed: false },
      { id: "p-gro-p", expenseId: "exp-groceries", userId: pavan, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
    ];
    const credits = [
      { id: "credit-1", userId: charan, owedByUserId: aiverse, usedCredit: 30000, status: "PENDING_SETTLEMENT" },
    ];

    // Aiverse owes ₹1,000 credit + ₹300 own grocery share
    expect(computeNetBalance(aiverse, expenses, participants, baseSettlements, credits).netBalance).toBe(-130000);
    // Charan is owed ₹1,000 minus his ₹300 grocery share
    expect(computeNetBalance(charan, expenses, participants, baseSettlements, credits).netBalance).toBe(70000);
    // Pavan is owed both grocery shares (Charan's via Aiverse, pending)
    expect(computeNetBalance(pavan, expenses, participants, baseSettlements, credits).netBalance).toBe(60000);
  });

  it("after Aiverse settles the proposal: real settlement is not double-counted", () => {
    const participants = [
      ...rentShares,
      { id: "p-gro-a", expenseId: "exp-groceries", userId: aiverse, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
      { id: "p-gro-c", expenseId: "exp-groceries", userId: charan, shareAmount: 30000, creditApplied: 30000, creditConfirmed: true },
      { id: "p-gro-p", expenseId: "exp-groceries", userId: pavan, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
    ];
    const settlements = [
      ...baseSettlements,
      { payerId: aiverse, payeeId: pavan, amount: 30000 }, // proposal confirmation
    ];
    const credits = [
      { id: "credit-1", userId: charan, owedByUserId: aiverse, usedCredit: 30000, status: "SETTLED" },
    ];
    const confirmedProposals = [
      { sourceCreditId: "credit-1", participantId: "p-gro-c", amount: 30000 },
    ];

    // Aiverse: ₹700 remaining credit to Charan + ₹300 own grocery share
    expect(computeNetBalance(aiverse, expenses, participants, settlements, credits, confirmedProposals).netBalance).toBe(-100000);
    // Charan: ₹700 credit remaining
    expect(computeNetBalance(charan, expenses, participants, settlements, credits, confirmedProposals).netBalance).toBe(70000);
    // Pavan: still owed Aiverse's own ₹300 share — must NOT show settled
    expect(computeNetBalance(pavan, expenses, participants, settlements, credits, confirmedProposals).netBalance).toBe(30000);
  });

  it("instant-path credit (no proposal) still uses virtual adjustments", () => {
    // Charan applies credit to a share on AIVERSE's own expense — no real
    // settlement happens, the virtuals must still cover it.
    const participants = [
      ...rentShares.filter((p) => p.id !== "p-rent-c"),
      { id: "p-rent-c", expenseId: "exp-rent", userId: charan, shareAmount: 300000, creditApplied: 0, creditConfirmed: false },
      { id: "p-gro2-a", expenseId: "exp-groceries2", userId: aiverse, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
      { id: "p-gro2-c", expenseId: "exp-groceries2", userId: charan, shareAmount: 30000, creditApplied: 30000, creditConfirmed: true },
      { id: "p-gro2-p", expenseId: "exp-groceries2", userId: pavan, shareAmount: 30000, creditApplied: 0, creditConfirmed: false },
    ];
    const expensesWithSecond = [
      { id: "exp-rent", paidBy: aiverse },
      { id: "exp-groceries2", paidBy: aiverse }, // Aiverse paid — instant path
    ];
    const credits = [
      { id: "credit-1", userId: charan, owedByUserId: aiverse, usedCredit: 30000, status: "SETTLED" },
    ];

    // No confirmed proposals — instant path
    const a = computeNetBalance(aiverse, expensesWithSecond, participants, baseSettlements, credits, []);
    const c = computeNetBalance(charan, expensesWithSecond, participants, baseSettlements, credits, []);
    const p = computeNetBalance(pavan, expensesWithSecond, participants, baseSettlements, credits, []);

    // Aiverse: owes Charan ₹700 remaining credit, is owed ₹300 by Pavan (groceries2)
    expect(a.netBalance).toBe(-40000);
    // Charan: ₹700 credit remaining
    expect(c.netBalance).toBe(70000);
    // Pavan: owes his ₹300 groceries2 share
    expect(p.netBalance).toBe(-30000);
    expect(a.netBalance + c.netBalance + p.netBalance).toBe(0);
  });
});
