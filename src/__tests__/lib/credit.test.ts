import { describe, it, expect } from "vitest";
import { computeCreditReturnPortion } from "@/lib/credit";

describe("computeCreditReturnPortion", () => {
  it("returns 0 when the settlement exactly covers expense debt", () => {
    // Bob owes Alice ₹500, pays ₹500 — nothing is a credit return
    expect(computeCreditReturnPortion(50000, 50000, 50000)).toBe(0);
  });

  it("returns 0 when the settlement undershoots expense debt", () => {
    // Bob owes ₹500, pays ₹300 — still ₹200 short, no surplus
    expect(computeCreditReturnPortion(30000, 50000, 30000)).toBe(0);
  });

  it("returns only the surplus when the settlement overshoots expense debt", () => {
    // Bob owes ₹500, pays ₹700 — ₹200 is surplus (credit return)
    expect(computeCreditReturnPortion(70000, 50000, 70000)).toBe(20000);
  });

  it("returns the full settlement when there is no expense debt", () => {
    // Pure credit return: Bob owes nothing, pays ₹1,000 back
    expect(computeCreditReturnPortion(100000, 0, 100000)).toBe(100000);
  });

  it("accounts for earlier payments toward the same debt", () => {
    // Bob owes ₹500 total, already paid ₹400 earlier, now pays ₹300.
    // ₹100 finishes the debt, ₹200 is surplus.
    expect(computeCreditReturnPortion(30000, 50000, 70000)).toBe(20000);
  });

  it("caps the return portion at the settlement amount", () => {
    // Historical surplus is huge, but this settlement is only ₹100 —
    // at most ₹100 of it can be a return
    expect(computeCreditReturnPortion(10000, 0, 500000)).toBe(10000);
  });

  it("never returns a negative portion", () => {
    expect(computeCreditReturnPortion(10000, 99999, 10000)).toBe(0);
  });
});
