import { describe, it, expect } from "vitest";
import { calculateEqualShares } from "@/lib/split";

describe("calculateEqualShares", () => {
  it("splits evenly when divisible", () => {
    const result = calculateEqualShares(300, ["alice", "bob", "charlie"]);
    expect(result).toEqual([
      { userId: "alice", shareAmount: 100 },
      { userId: "bob", shareAmount: 100 },
      { userId: "charlie", shareAmount: 100 },
    ]);
  });

  it("gives remainder to first participant", () => {
    const result = calculateEqualShares(100, ["alice", "bob", "charlie"]);
    // 100 / 3 = 33 base, remainder 1 → alice gets 34
    expect(result[0].shareAmount).toBe(34);
    expect(result[1].shareAmount).toBe(33);
    expect(result[2].shareAmount).toBe(33);
  });

  it("sum always equals total amount", () => {
    const cases = [
      { total: 100, count: 3 },
      { total: 10, count: 3 },
      { total: 999, count: 7 },
      { total: 1500000, count: 4 },
    ];
    for (const { total, count } of cases) {
      const ids = Array.from({ length: count }, (_, i) => `user-${i}`);
      const result = calculateEqualShares(total, ids);
      const sum = result.reduce((s, p) => s + p.shareAmount, 0);
      expect(sum).toBe(total);
    }
  });

  it("handles single participant", () => {
    const result = calculateEqualShares(500, ["alice"]);
    expect(result).toEqual([{ userId: "alice", shareAmount: 500 }]);
  });

  it("handles large paise amounts (rent)", () => {
    // ₹15,000 = 1,500,000 paise split 3 ways
    const result = calculateEqualShares(1500000, ["alice", "bob", "charlie"]);
    expect(result.every((p) => p.shareAmount === 500000)).toBe(true);
  });
});
