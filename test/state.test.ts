import { describe, expect, it } from "vitest";
import {
  advanceState,
  parseState,
  type State,
  serializeState,
} from "../src/state.js";

const state: State = {
  lastCheckedAt: "2026-10-30T12:00:00Z",
  notified: ["owner/repo#1", "owner/repo#2"],
};

describe("parseState", () => {
  it("serializeState で保存した内容を読み込める", () => {
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it("lastCheckedAt が日時でない場合はエラーになる", () => {
    expect(() =>
      parseState(JSON.stringify({ lastCheckedAt: "yesterday", notified: [] })),
    ).toThrow("の内容が不正です");
  });

  it("notified がない場合はエラーになる", () => {
    expect(() =>
      parseState(JSON.stringify({ lastCheckedAt: state.lastCheckedAt })),
    ).toThrow("の内容が不正です");
  });

  it("JSON でない場合はエラーになる", () => {
    expect(() => parseState("not json")).toThrow();
  });
});

describe("advanceState", () => {
  it("確認時刻を更新し、通知した Issue を末尾に追加する", () => {
    expect(
      advanceState(state, {
        checkedAt: "2026-10-30T12:30:00Z",
        notifiedKeys: ["owner/repo#3"],
        maxNotifiedHistory: 10,
      }),
    ).toEqual({
      lastCheckedAt: "2026-10-30T12:30:00Z",
      notified: ["owner/repo#1", "owner/repo#2", "owner/repo#3"],
    });
  });

  it("記録済みの Issue は重複して追加しない", () => {
    expect(
      advanceState(state, {
        checkedAt: "2026-10-30T12:30:00Z",
        notifiedKeys: ["owner/repo#2", "owner/repo#3"],
        maxNotifiedHistory: 10,
      }).notified,
    ).toEqual(["owner/repo#1", "owner/repo#2", "owner/repo#3"]);
  });

  it("上限件数を超えたら古いものから削除する", () => {
    expect(
      advanceState(state, {
        checkedAt: "2026-10-30T12:30:00Z",
        notifiedKeys: ["owner/repo#3", "owner/repo#4"],
        maxNotifiedHistory: 3,
      }).notified,
    ).toEqual(["owner/repo#2", "owner/repo#3", "owner/repo#4"]);
  });

  it("元の状態を変更しない", () => {
    const before = structuredClone(state);
    advanceState(state, {
      checkedAt: "2026-10-30T12:30:00Z",
      notifiedKeys: ["owner/repo#3"],
      maxNotifiedHistory: 1,
    });
    expect(state).toEqual(before);
  });
});
