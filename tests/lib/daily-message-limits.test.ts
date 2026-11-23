import { describe, expect, it } from "vitest";
import {
  getJstDayBounds,
  getRemainingDailyActions,
} from "../../lib/daily-message-limits";

describe("daily message limits", () => {
  it("uses the JST calendar day and resets at midnight", () => {
    const beforeMidnight = getJstDayBounds(
      new Date("2026-11-23T14:59:59.999Z"),
    );
    expect(beforeMidnight.startsAt.toISOString()).toBe(
      "2026-11-22T15:00:00.000Z",
    );
    expect(beforeMidnight.resetsAt.toISOString()).toBe(
      "2026-11-23T15:00:00.000Z",
    );

    const atMidnight = getJstDayBounds(new Date("2026-11-23T15:00:00.000Z"));
    expect(atMidnight.startsAt.toISOString()).toBe(
      "2026-11-23T15:00:00.000Z",
    );
    expect(atMidnight.resetsAt.toISOString()).toBe(
      "2026-11-24T15:00:00.000Z",
    );
  });

  it("allows one send per category and reports no remaining sends after that", () => {
    expect(getRemainingDailyActions(0)).toBe(1);
    expect(getRemainingDailyActions(1)).toBe(0);
    expect(getRemainingDailyActions(2)).toBe(0);
  });
});
