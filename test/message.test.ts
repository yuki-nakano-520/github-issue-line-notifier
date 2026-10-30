import { describe, expect, it } from "vitest";
import type { Issue } from "../src/issue.js";
import { buildMessage, formatDateTime, previewBody } from "../src/message.js";

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  repository: "owner/repo",
  number: 1,
  title: "タイトル",
  url: "https://github.com/owner/repo/issues/1",
  labels: ["good first issue"],
  author: "octocat",
  createdAt: "2026-10-30T12:00:00Z",
  body: "本文",
  ...overrides,
});

describe("formatDateTime", () => {
  it("日本時間で表示する", () => {
    expect(formatDateTime("2026-10-30T15:30:00Z")).toBe("2026/10/31 00:30");
  });
});

describe("previewBody", () => {
  it("改行と連続する空白を 1 つの空白にまとめる", () => {
    expect(previewBody("  1行目\r\n\n2行目\t 3行目  ", 100)).toBe(
      "1行目 2行目 3行目",
    );
  });

  it("maxLength を超える分は切り詰めて … を付ける", () => {
    expect(previewBody("あいうえお", 3)).toBe("あいう…");
  });

  it("maxLength ちょうどなら切り詰めない", () => {
    expect(previewBody("あいう", 3)).toBe("あいう");
  });

  it("絵文字を途中で分割しない", () => {
    expect(previewBody("😀😀😀", 2)).toBe("😀😀…");
  });
});

describe("buildMessage", () => {
  it("Issue の詳細を並べたメッセージを組み立てる", () => {
    const issue = createIssue();

    const message = buildMessage({
      issues: [issue],
      summaries: new Map([["owner/repo#1", "要約文"]]),
      bodyPreviewLength: 100,
    });

    expect(message).toBe(
      [
        "【新着 Issue】1 件",
        "",
        "■ owner/repo",
        "タイトル",
        "ラベル: good first issue",
        "作成: @octocat 2026/10/30 21:00",
        "本文",
        "要約: 要約文",
        "https://github.com/owner/repo/issues/1",
      ].join("\n"),
    );
  });

  it("ラベル・本文・要約がない場合はその行を省く", () => {
    const message = buildMessage({
      issues: [createIssue({ labels: [], body: "  " })],
      summaries: new Map(),
      bodyPreviewLength: 100,
    });

    expect(message).toBe(
      [
        "【新着 Issue】1 件",
        "",
        "■ owner/repo",
        "タイトル",
        "作成: @octocat 2026/10/30 21:00",
        "https://github.com/owner/repo/issues/1",
      ].join("\n"),
    );
  });

  it("maxLength に収まらない分は「他 N 件」と表示する", () => {
    const issues = [1, 2, 3].map((number) =>
      createIssue({ number, url: `https://example.com/${number}` }),
    );
    const oneIssueMessage = buildMessage({
      issues: issues.slice(0, 1),
      summaries: new Map(),
      bodyPreviewLength: 100,
    });

    const message = buildMessage({
      issues,
      summaries: new Map(),
      bodyPreviewLength: 100,
      maxLength: oneIssueMessage.length + "\n\n他 2 件".length,
    });

    expect(message).toContain("https://example.com/1");
    expect(message).not.toContain("https://example.com/2");
    expect(message.startsWith("【新着 Issue】3 件")).toBe(true);
    expect(message.endsWith("他 2 件")).toBe(true);
  });

  it("全件が maxLength に収まる場合は「他 N 件」を表示しない", () => {
    const message = buildMessage({
      issues: [createIssue({ number: 1 }), createIssue({ number: 2 })],
      summaries: new Map(),
      bodyPreviewLength: 100,
    });

    expect(message).not.toContain("他");
  });

  it("1 件も収まらない場合は件数だけ表示する", () => {
    const message = buildMessage({
      issues: [createIssue()],
      summaries: new Map(),
      bodyPreviewLength: 100,
      maxLength: 30,
    });

    expect(message).toBe("【新着 Issue】1 件\n\n他 1 件");
  });
});
