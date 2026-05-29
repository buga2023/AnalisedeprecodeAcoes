// src/lib/billing.test.ts
import { describe, it, expect } from "vitest";
import {
  PRO_PRICE_BRL,
  FREE_MONTHLY_LIMIT,
  PAYWALLED_FEATURES,
  hasProAccess,
  currentMonthKey,
  featureLabels,
} from "./billing";
import type { Subscription } from "@/types/stock";

function sub(status: Subscription["status"]): Subscription {
  return {
    id: "s1",
    userId: "u1",
    mpPreapprovalId: "mp1",
    plan: "pro",
    status,
    amountBRL: 29,
    startedAt: null,
    currentPeriodEnd: null,
    cancelledAt: null,
  };
}

describe("billing", () => {
  it("constants", () => {
    expect(PRO_PRICE_BRL).toBe(29);
    expect(FREE_MONTHLY_LIMIT).toBe(10);
    expect(PAYWALLED_FEATURES).toContain("ai-analysis");
    expect(PAYWALLED_FEATURES.length).toBe(8);
  });

  it("hasProAccess: active e cancelled mantem acesso; resto nao", () => {
    expect(hasProAccess(sub("active"))).toBe(true);
    expect(hasProAccess(sub("cancelled"))).toBe(true); // acesso ate fim do periodo
    expect(hasProAccess(sub("pending"))).toBe(false);
    expect(hasProAccess(sub("paused"))).toBe(false);
    expect(hasProAccess(sub("past_due"))).toBe(false);
    expect(hasProAccess(null)).toBe(false);
  });

  it("currentMonthKey: YYYY-MM em UTC", () => {
    expect(currentMonthKey(new Date("2026-01-05T23:00:00Z"))).toBe("2026-01");
    expect(currentMonthKey(new Date("2026-12-31T12:00:00Z"))).toBe("2026-12");
  });

  it("featureLabels cobre todas as features", () => {
    for (const f of PAYWALLED_FEATURES) {
      expect(typeof featureLabels[f]).toBe("string");
      expect(featureLabels[f].length).toBeGreaterThan(0);
    }
  });
});
