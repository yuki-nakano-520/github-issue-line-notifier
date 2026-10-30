import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_PREVIEW_LENGTH,
  DEFAULT_MAX_NOTIFIED_HISTORY,
  parseConfig,
} from "../src/config.js";

describe("parseConfig", () => {
  it("省略した項目にはデフォルト値が入る", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels:
      - good first issue
`);

    expect(config).toEqual({
      repositories: [{ name: "owner/repo", labels: ["good first issue"] }],
      bodyPreviewLength: DEFAULT_BODY_PREVIEW_LENGTH,
      maxNotifiedHistory: DEFAULT_MAX_NOTIFIED_HISTORY,
      summary: { enabled: false },
    });
  });

  it("指定した値が使われる", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels: [bug, help wanted]
  - name: other-owner/other.repo
    labels: [good first issue]
bodyPreviewLength: 50
maxNotifiedHistory: 200
summary:
  enabled: true
  baseUrl: https://api.example.com/v1
  model: model-name
`);

    expect(config).toEqual({
      repositories: [
        { name: "owner/repo", labels: ["bug", "help wanted"] },
        { name: "other-owner/other.repo", labels: ["good first issue"] },
      ],
      bodyPreviewLength: 50,
      maxNotifiedHistory: 200,
      summary: {
        enabled: true,
        baseUrl: "https://api.example.com/v1",
        model: "model-name",
      },
    });
  });

  it("summary を無効にした場合は baseUrl と model がなくてもよい", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels: [bug]
summary:
  enabled: false
`);

    expect(config.summary).toEqual({ enabled: false });
  });

  it.each([
    ["repositories がない場合", "bodyPreviewLength: 100"],
    ["repositories が空の場合", "repositories: []"],
    [
      "リポジトリ名が owner/repo の形式でない場合",
      "repositories:\n  - name: repo\n    labels: [bug]",
    ],
    [
      "labels が空の場合",
      "repositories:\n  - name: owner/repo\n    labels: []",
    ],
    [
      "bodyPreviewLength が 0 の場合",
      "repositories:\n  - name: owner/repo\n    labels: [bug]\nbodyPreviewLength: 0",
    ],
    [
      "summary を有効にして model がない場合",
      "repositories:\n  - name: owner/repo\n    labels: [bug]\nsummary:\n  enabled: true\n  baseUrl: https://api.example.com/v1",
    ],
    [
      "summary.baseUrl が URL でない場合",
      "repositories:\n  - name: owner/repo\n    labels: [bug]\nsummary:\n  enabled: true\n  baseUrl: example\n  model: model-name",
    ],
  ])("%sはエラーになる", (_, text) => {
    expect(() => parseConfig(text)).toThrow("設定ファイルが不正です");
  });
});
