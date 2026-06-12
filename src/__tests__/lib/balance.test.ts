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
