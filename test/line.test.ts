import { describe, expect, it } from "vitest";
import { remainingQuota } from "../src/line.js";

describe("remainingQuota", () => {
  it("上限から当月の使用数を引いた値を返す", () => {
    expect(
      remainingQuota({ type: "limited", value: 200 }, { totalUsage: 150 }),
    ).toBe(50);
  });

  it("使い切っている場合は 0 を返す", () => {
    expect(
      remainingQuota({ type: "limited", value: 200 }, { totalUsage: 200 }),
    ).toBe(0);
  });

  it("使用数が上限を超えていても 0 を返す", () => {
    expect(
      remainingQuota({ type: "limited", value: 200 }, { totalUsage: 210 }),
    ).toBe(0);
  });

  it("上限がない場合は Infinity を返す", () => {
    expect(remainingQuota({ type: "none" }, { totalUsage: 1000 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
