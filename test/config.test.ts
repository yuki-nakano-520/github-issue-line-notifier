import { describe, expect, it } from "vitest";
import {
  DEFAULT_BODY_PREVIEW_LENGTH,
  DEFAULT_EXCLUDE,
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
      repositories: [
        {
          name: "owner/repo",
          labels: ["good first issue"],
          exclude: DEFAULT_EXCLUDE,
        },
      ],
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
        {
          name: "owner/repo",
          labels: ["bug", "help wanted"],
          exclude: DEFAULT_EXCLUDE,
        },
        {
          name: "other-owner/other.repo",
          labels: ["good first issue"],
          exclude: DEFAULT_EXCLUDE,
        },
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

  it("全体の exclude がリポジトリごとの既定値になる", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels: [bug]
exclude:
  linkedPullRequest: true
  assigned: true
`);

    expect(config.repositories[0]?.exclude).toEqual({
      linkedPullRequest: true,
      assigned: true,
    });
  });

  it("リポジトリの exclude は、書いた項目だけ全体の設定を上書きする", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels: [bug]
    exclude:
      assigned: false
  - name: owner/other
    labels: [bug]
exclude:
  linkedPullRequest: true
  assigned: true
`);

    expect(config.repositories.map((repository) => repository.exclude)).toEqual(
      [
        { linkedPullRequest: true, assigned: false },
        { linkedPullRequest: true, assigned: true },
      ],
    );
  });

  it("全体の exclude で省略した項目は除外しない", () => {
    const config = parseConfig(`
repositories:
  - name: owner/repo
    labels: [bug]
    exclude:
      assigned: true
exclude:
  linkedPullRequest: true
`);

    expect(config.repositories[0]?.exclude).toEqual({
      linkedPullRequest: true,
      assigned: true,
    });
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
    [
      "exclude の値が真偽値でない場合",
      "repositories:\n  - name: owner/repo\n    labels: [bug]\nexclude:\n  assigned: yes",
    ],
  ])("%sはエラーになる", (_, text) => {
    expect(() => parseConfig(text)).toThrow("設定ファイルが不正です");
  });
});
