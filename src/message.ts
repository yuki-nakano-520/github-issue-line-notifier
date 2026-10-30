import { type Issue, issueKey } from "./issue.js";

/** LINE のテキストメッセージの最大文字数 */
export const LINE_TEXT_MAX_LENGTH = 5000;

const DISPLAY_TIME_ZONE = "Asia/Tokyo";
const ELLIPSIS = "…";
const BLOCK_SEPARATOR = "\n\n";

const dateTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDateTime = (iso: string): string =>
  dateTimeFormat.format(new Date(iso));

/** 改行や連続する空白を 1 つの空白にまとめ、先頭から maxLength 文字に切り詰める */
export const previewBody = (body: string, maxLength: number): string => {
  const chars = Array.from(body.replace(/\s+/g, " ").trim());
  return chars.length > maxLength
    ? `${chars.slice(0, maxLength).join("")}${ELLIPSIS}`
    : chars.join("");
};

type BuildMessageOptions = {
  issues: Issue[];
  /** issueKey をキーにした日本語要約 */
  summaries: ReadonlyMap<string, string>;
  bodyPreviewLength: number;
  maxLength?: number;
};

const formatIssue = (
  issue: Issue,
  summary: string | undefined,
  bodyPreviewLength: number,
): string => {
  const preview = previewBody(issue.body, bodyPreviewLength);
  const lines = [
    `■ ${issue.repository}`,
    issue.title,
    issue.labels.length > 0 ? `ラベル: ${issue.labels.join(", ")}` : undefined,
    `作成: @${issue.author} ${formatDateTime(issue.createdAt)}`,
    preview === "" ? undefined : preview,
    summary === undefined ? undefined : `要約: ${summary}`,
    issue.url,
  ];
  return lines.filter((line) => line !== undefined).join("\n");
};

const formatRest = (count: number): string | undefined =>
  count > 0 ? `他 ${count} 件` : undefined;

/**
 * 通知メッセージを組み立てる。
 * maxLength に収まる件数まで詳細を載せ、残りは「他 N 件」と件数だけ表示する。
 */
export const buildMessage = ({
  issues,
  summaries,
  bodyPreviewLength,
  maxLength = LINE_TEXT_MAX_LENGTH,
}: BuildMessageOptions): string => {
  const header = `【新着 Issue】${issues.length} 件`;
  const join = (blocks: string[], restCount: number): string =>
    [header, ...blocks, formatRest(restCount)]
      .filter((block) => block !== undefined)
      .join(BLOCK_SEPARATOR);

  const blocks: string[] = [];
  for (const issue of issues) {
    const block = formatIssue(
      issue,
      summaries.get(issueKey(issue)),
      bodyPreviewLength,
    );
    const restCount = issues.length - blocks.length - 1;
    if (join([...blocks, block], restCount).length > maxLength) {
      break;
    }
    blocks.push(block);
  }

  return join(blocks, issues.length - blocks.length);
};
