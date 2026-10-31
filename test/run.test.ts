import { describe, expect, it } from "vitest";
import { type Config, DEFAULT_EXCLUDE } from "../src/config.js";
import type { Issue } from "../src/issue.js";
import { type RunDependencies, run } from "../src/run.js";
import type { State } from "../src/state.js";

const NOW = "2026-10-30T12:30:00.000Z";
const LAST_CHECKED_AT = "2026-10-30T12:00:00.000Z";

const config: Config = {
  repositories: [
    { name: "owner/repo", labels: ["bug"], exclude: DEFAULT_EXCLUDE },
    {
      name: "owner/other",
      labels: ["good first issue"],
      exclude: DEFAULT_EXCLUDE,
    },
  ],
  bodyPreviewLength: 100,
  maxNotifiedHistory: 1000,
  summary: { enabled: false },
};

const createIssue = (repository: string, number: number): Issue => ({
  repository,
  number,
  title: `タイトル${number}`,
  url: `https://github.com/${repository}/issues/${number}`,
  labels: ["bug"],
  author: "octocat",
  createdAt: "2026-10-30T12:10:00Z",
  body: "本文",
});

type Fake = {
  dependencies: RunDependencies;
  saved: State[];
  pushed: string[];
  warnings: string[];
};

type FakeOptions = {
  /** null は状態がまだ保存されていない(初回実行)ことを表す */
  state?: State | null;
  issues?: Record<string, Issue[]>;
  canNotify?: boolean;
  pushError?: Error;
  summarize?: RunDependencies["summarize"];
};

const createFake = ({
  state = { lastCheckedAt: LAST_CHECKED_AT, notified: [] },
  issues = {},
  canNotify = true,
  pushError,
  summarize,
}: FakeOptions = {}): Fake => {
  const saved: State[] = [];
  const pushed: string[] = [];
  const warnings: string[] = [];
  return {
    saved,
    pushed,
    warnings,
    dependencies: {
      config,
      stateStore: {
        load: async () => state ?? undefined,
        save: async (newState) => {
          saved.push(newState);
        },
      },
      searchIssues: async (repository) => issues[repository.name] ?? [],
      summarize,
      notifier: {
        canNotify: async () => canNotify,
        push: async (text) => {
          if (pushError) {
            throw pushError;
          }
          pushed.push(text);
        },
      },
      now: () => new Date(NOW),
      logger: {
        info: () => {},
        warn: (message) => {
          warnings.push(message);
        },
      },
    },
  };
};

describe("run", () => {
  it("初回実行では通知せず、現在時刻を記録する", async () => {
    const fake = createFake({
      state: null,
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
    });

    expect(await run(fake.dependencies)).toBe("initialized");
    expect(fake.pushed).toEqual([]);
    expect(fake.saved).toEqual([{ lastCheckedAt: NOW, notified: [] }]);
  });

  it("新しい Issue をまとめて 1 通で通知し、状態を更新する", async () => {
    const fake = createFake({
      issues: {
        "owner/repo": [createIssue("owner/repo", 1)],
        "owner/other": [createIssue("owner/other", 2)],
      },
    });

    expect(await run(fake.dependencies)).toBe("notified");
    expect(fake.pushed).toHaveLength(1);
    expect(fake.pushed[0]).toContain("【新着 Issue】2 件");
    expect(fake.saved).toEqual([
      { lastCheckedAt: NOW, notified: ["owner/repo#1", "owner/other#2"] },
    ]);
  });

  it("通知済みの Issue は通知しない", async () => {
    const fake = createFake({
      state: { lastCheckedAt: LAST_CHECKED_AT, notified: ["owner/repo#1"] },
      issues: {
        "owner/repo": [
          createIssue("owner/repo", 1),
          createIssue("owner/repo", 2),
        ],
      },
    });

    await run(fake.dependencies);

    expect(fake.pushed[0]).toContain("【新着 Issue】1 件");
    expect(fake.pushed[0]).not.toContain("タイトル1");
    expect(fake.saved[0]?.notified).toEqual(["owner/repo#1", "owner/repo#2"]);
  });

  it("新しい Issue がない場合は通知せず、確認時刻だけ更新する", async () => {
    const fake = createFake({
      state: { lastCheckedAt: LAST_CHECKED_AT, notified: ["owner/repo#1"] },
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
    });

    expect(await run(fake.dependencies)).toBe("no-new-issues");
    expect(fake.pushed).toEqual([]);
    expect(fake.saved).toEqual([
      { lastCheckedAt: NOW, notified: ["owner/repo#1"] },
    ]);
  });

  it("送信可能数を使い切っている場合は、通知も状態の更新もしない", async () => {
    let summarized = false;
    const fake = createFake({
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
      canNotify: false,
      summarize: async () => {
        summarized = true;
        return new Map();
      },
    });

    expect(await run(fake.dependencies)).toBe("quota-exceeded");
    expect(fake.pushed).toEqual([]);
    expect(fake.saved).toEqual([]);
    expect(summarized).toBe(false);
  });

  it("送信に失敗した場合は状態を更新せずに例外を投げる", async () => {
    const fake = createFake({
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
      pushError: new Error("LINE error"),
    });

    await expect(run(fake.dependencies)).rejects.toThrow("LINE error");
    expect(fake.saved).toEqual([]);
  });

  it("要約をメッセージに含める", async () => {
    const fake = createFake({
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
      summarize: async () => new Map([["owner/repo#1", "日本語の要約"]]),
    });

    await run(fake.dependencies);

    expect(fake.pushed[0]).toContain("要約: 日本語の要約");
  });

  it("要約に失敗した場合は警告を出し、要約なしで通知する", async () => {
    const fake = createFake({
      issues: { "owner/repo": [createIssue("owner/repo", 1)] },
      summarize: async () => {
        throw new Error("timeout");
      },
    });

    expect(await run(fake.dependencies)).toBe("notified");
    expect(fake.pushed[0]).not.toContain("要約:");
    expect(fake.warnings[0]).toContain("timeout");
  });
});
