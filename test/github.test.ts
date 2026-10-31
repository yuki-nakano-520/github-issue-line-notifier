import { describe, expect, it } from "vitest";
import {
  buildSearchQuery,
  DELETED_USER_LOGIN,
  type SearchItem,
  searchSince,
  toIssue,
} from "../src/github.js";

const createItem = (overrides: Partial<SearchItem> = {}): SearchItem => ({
  number: 123,
  title: "タイトル",
  html_url: "https://github.com/owner/repo/issues/123",
  created_at: "2026-10-30T12:00:00Z",
  body: "本文",
  labels: [{ name: "good first issue" }, { name: "bug" }],
  user: { login: "octocat" },
  ...overrides,
});

describe("searchSince", () => {
  it("前回の確認時刻から 10 分さかのぼった時刻を秒単位で返す", () => {
    expect(searchSince("2026-10-30T12:00:00.123Z")).toBe(
      "2026-10-30T11:50:00Z",
    );
  });

  it("日付をまたいでさかのぼれる", () => {
    expect(searchSince("2026-10-31T00:05:00Z")).toBe("2026-10-30T23:55:00Z");
  });
});

describe("buildSearchQuery", () => {
  it("いずれかのラベルが付いた open な Issue を更新日時で絞り込むクエリを作る", () => {
    expect(
      buildSearchQuery(
        {
          name: "owner/repo",
          labels: ["good first issue", "bug"],
          exclude: { linkedPullRequest: false, assigned: false },
        },
        "2026-10-30T11:50:00Z",
      ),
    ).toBe(
      'repo:owner/repo is:issue is:open label:"good first issue","bug" updated:>=2026-10-30T11:50:00Z',
    );
  });

  it.each([
    [
      "Pull Request が紐付いた Issue",
      { linkedPullRequest: true, assigned: false },
      "-linked:pr",
    ],
    [
      "担当者が決まっている Issue",
      { linkedPullRequest: false, assigned: true },
      "no:assignee",
    ],
    [
      "両方",
      { linkedPullRequest: true, assigned: true },
      "-linked:pr no:assignee",
    ],
  ])("%sを除外する条件を加える", (_, exclude, qualifiers) => {
    expect(
      buildSearchQuery(
        { name: "owner/repo", labels: ["bug"], exclude },
        "2026-10-30T11:50:00Z",
      ),
    ).toBe(
      `repo:owner/repo is:issue is:open label:"bug" ${qualifiers} updated:>=2026-10-30T11:50:00Z`,
    );
  });
});

describe("toIssue", () => {
  it("検索結果を Issue に変換する", () => {
    expect(toIssue("owner/repo", createItem())).toEqual({
      repository: "owner/repo",
      number: 123,
      title: "タイトル",
      url: "https://github.com/owner/repo/issues/123",
      labels: ["good first issue", "bug"],
      author: "octocat",
      createdAt: "2026-10-30T12:00:00Z",
      body: "本文",
    });
  });

  it("本文がない場合は空文字にする", () => {
    expect(toIssue("owner/repo", createItem({ body: null })).body).toBe("");
  });

  it("作成者が削除されている場合は ghost にする", () => {
    expect(toIssue("owner/repo", createItem({ user: null })).author).toBe(
      DELETED_USER_LOGIN,
    );
  });

  it("名前のないラベルは除外する", () => {
    expect(
      toIssue("owner/repo", createItem({ labels: [{}, { name: "bug" }] }))
        .labels,
    ).toEqual(["bug"]);
  });
});
