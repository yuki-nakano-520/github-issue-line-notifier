import { describe, expect, it } from "vitest";
import type { SummaryConfig } from "../src/config.js";
import type { Issue } from "../src/issue.js";
import {
  buildSummaryInput,
  type FetchFunction,
  parseSummaryContent,
  SUMMARY_BODY_MAX_LENGTH,
  summarizeIssues,
} from "../src/summary.js";

const createIssue = (overrides: Partial<Issue> = {}): Issue => ({
  repository: "owner/repo",
  number: 1,
  title: "タイトル",
  url: "https://github.com/owner/repo/issues/1",
  labels: ["bug"],
  author: "octocat",
  createdAt: "2026-10-30T12:00:00Z",
  body: "本文",
  ...overrides,
});

const config: SummaryConfig = {
  enabled: true,
  baseUrl: "https://api.example.com/v1/",
  model: "model-name",
};

type Request = { url: string; init: RequestInit };

/** 呼び出し内容を記録し、指定した応答を返す fetch */
const createFetch = (
  response: Response,
): { fetchFunction: FetchFunction; requests: Request[] } => {
  const requests: Request[] = [];
  return {
    requests,
    fetchFunction: async (url, init) => {
      requests.push({ url, init });
      return response;
    },
  };
};

const chatCompletion = (content: string): Response =>
  Response.json({ choices: [{ message: { content } }] });

describe("buildSummaryInput", () => {
  it("キー・タイトル・ラベル・本文を JSON にする", () => {
    expect(JSON.parse(buildSummaryInput([createIssue()]))).toEqual([
      { key: "owner/repo#1", title: "タイトル", labels: ["bug"], body: "本文" },
    ]);
  });

  it("本文を上限の文字数で切り詰める", () => {
    const body = "あ".repeat(SUMMARY_BODY_MAX_LENGTH + 1);
    const [input] = JSON.parse(buildSummaryInput([createIssue({ body })]));
    expect(input.body).toHaveLength(SUMMARY_BODY_MAX_LENGTH);
  });
});

describe("parseSummaryContent", () => {
  it("JSON オブジェクトから要約を取り出す", () => {
    expect(
      parseSummaryContent('{"owner/repo#1": "要約"}', ["owner/repo#1"]),
    ).toEqual(new Map([["owner/repo#1", "要約"]]));
  });

  it("コードブロックで囲まれていても読める", () => {
    expect(
      parseSummaryContent('```json\n{"owner/repo#1": "要約"}\n```', [
        "owner/repo#1",
      ]),
    ).toEqual(new Map([["owner/repo#1", "要約"]]));
  });

  it("送っていないキーと空の要約は無視する", () => {
    expect(
      parseSummaryContent(
        '{"owner/repo#1": "  ", "owner/repo#2": "要約", "other#3": "余分"}',
        ["owner/repo#1", "owner/repo#2"],
      ),
    ).toEqual(new Map([["owner/repo#2", "要約"]]));
  });

  it("値が文字列でない場合はエラーになる", () => {
    expect(() =>
      parseSummaryContent('{"owner/repo#1": 1}', ["owner/repo#1"]),
    ).toThrow("要約の応答の形式が不正です");
  });

  it("JSON でない場合はエラーになる", () => {
    expect(() => parseSummaryContent("要約です", ["owner/repo#1"])).toThrow();
  });
});

describe("summarizeIssues", () => {
  it("Chat Completions API を呼び出して要約を返す", async () => {
    const { fetchFunction, requests } = createFetch(
      chatCompletion('{"owner/repo#1": "要約"}'),
    );

    const summaries = await summarizeIssues({
      config,
      apiKey: "secret",
      issues: [createIssue()],
      fetchFunction,
    });

    expect(summaries).toEqual(new Map([["owner/repo#1", "要約"]]));
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toBe("https://api.example.com/v1/chat/completions");
    expect(request?.init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
    });
    expect(JSON.parse(String(request?.init.body)).model).toBe("model-name");
  });

  it("API キーがない場合は Authorization ヘッダーを付けない", async () => {
    const { fetchFunction, requests } = createFetch(chatCompletion("{}"));

    await summarizeIssues({
      config,
      apiKey: undefined,
      issues: [createIssue()],
      fetchFunction,
    });

    expect(requests[0]?.init.headers).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("Issue がない場合は API を呼ばない", async () => {
    const { fetchFunction, requests } = createFetch(chatCompletion("{}"));

    const summaries = await summarizeIssues({
      config,
      apiKey: "secret",
      issues: [],
      fetchFunction,
    });

    expect(summaries.size).toBe(0);
    expect(requests).toHaveLength(0);
  });

  it("API がエラーを返した場合は例外を投げる", async () => {
    const { fetchFunction } = createFetch(
      new Response("rate limited", { status: 429 }),
    );

    await expect(
      summarizeIssues({
        config,
        apiKey: "secret",
        issues: [createIssue()],
        fetchFunction,
      }),
    ).rejects.toThrow("429 rate limited");
  });

  it("応答に choices がない場合は例外を投げる", async () => {
    const { fetchFunction } = createFetch(Response.json({ choices: [] }));

    await expect(
      summarizeIssues({
        config,
        apiKey: "secret",
        issues: [createIssue()],
        fetchFunction,
      }),
    ).rejects.toThrow("応答の形式が不正です");
  });
});
