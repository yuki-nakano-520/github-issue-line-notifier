import { z } from "zod";
import type { SummaryConfig } from "./config.js";
import { type Issue, issueKey } from "./issue.js";

/** LLM に渡す本文の最大文字数(トークン数を抑えるため) */
export const SUMMARY_BODY_MAX_LENGTH = 2000;

const SUMMARY_TIMEOUT_MILLISECONDS = 30_000;

const SYSTEM_PROMPT = [
  "あなたは GitHub の Issue を日本語で要約するアシスタントです。",
  "入力は Issue の JSON 配列です。各 Issue の内容を日本語 1〜2 文(80 文字程度)で要約してください。",
  "出力は、入力の key をキー、要約を値とする JSON オブジェクトだけにしてください。それ以外の文章は含めないでください。",
].join("\n");

export type FetchFunction = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

const chatCompletionResponseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string() }) }))
    .min(1),
});

const summariesSchema = z.record(z.string(), z.string());

const truncate = (text: string, maxLength: number): string =>
  Array.from(text).slice(0, maxLength).join("");

/** LLM に渡す Issue の一覧を JSON 文字列にする */
export const buildSummaryInput = (issues: Issue[]): string =>
  JSON.stringify(
    issues.map((issue) => ({
      key: issueKey(issue),
      title: issue.title,
      labels: issue.labels,
      body: truncate(issue.body, SUMMARY_BODY_MAX_LENGTH),
    })),
  );

/**
 * LLM の応答から要約を取り出す。
 * コードブロックで囲まれていれば取り除き、keys に含まれるキーの要約だけを返す。
 */
export const parseSummaryContent = (
  content: string,
  keys: string[],
): Map<string, string> => {
  const json = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const result = summariesSchema.safeParse(JSON.parse(json));
  if (!result.success) {
    throw new Error(
      `要約の応答の形式が不正です\n${z.prettifyError(result.error)}`,
    );
  }
  const summaries = new Map<string, string>();
  for (const key of keys) {
    const summary = result.data[key]?.trim();
    if (summary) {
      summaries.set(key, summary);
    }
  }
  return summaries;
};

type SummarizeIssuesOptions = {
  config: SummaryConfig;
  /** 不要なサービス(ローカル LLM など)では undefined */
  apiKey: string | undefined;
  issues: Issue[];
  fetchFunction?: FetchFunction;
};

/**
 * OpenAI 互換 API で Issue をまとめて要約し、issueKey をキーにした Map を返す。
 * 通信や応答の形式に問題がある場合は例外を投げる。
 */
export const summarizeIssues = async ({
  config,
  apiKey,
  issues,
  fetchFunction = fetch,
}: SummarizeIssuesOptions): Promise<Map<string, string>> => {
  if (issues.length === 0) {
    return new Map();
  }

  const response = await fetchFunction(
    `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildSummaryInput(issues) },
        ],
      }),
      signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MILLISECONDS),
    },
  );
  if (!response.ok) {
    throw new Error(
      `要約の API がエラーを返しました: ${response.status} ${await response.text()}`,
    );
  }

  const result = chatCompletionResponseSchema.safeParse(await response.json());
  if (!result.success) {
    throw new Error(
      `要約の API の応答の形式が不正です\n${z.prettifyError(result.error)}`,
    );
  }
  const [choice] = result.data.choices;
  return parseSummaryContent(
    choice?.message.content ?? "",
    issues.map(issueKey),
  );
};
