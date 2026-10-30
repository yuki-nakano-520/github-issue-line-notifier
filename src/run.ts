import type { Config, RepositoryConfig } from "./config.js";
import { type Issue, issueKey } from "./issue.js";
import type { LineNotifier } from "./line.js";
import { buildMessage } from "./message.js";
import { advanceState, type StateStore } from "./state.js";

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type RunDependencies = {
  config: Config;
  stateStore: StateStore;
  searchIssues: (
    repository: RepositoryConfig,
    lastCheckedAt: string,
  ) => Promise<Issue[]>;
  /** 要約が無効の場合は undefined */
  summarize: ((issues: Issue[]) => Promise<Map<string, string>>) | undefined;
  notifier: LineNotifier;
  now: () => Date;
  logger: Logger;
};

export type RunResult =
  | "initialized"
  | "no-new-issues"
  | "quota-exceeded"
  | "notified";

/** 同じ Issue が複数回含まれていれば 1 つにまとめる */
const uniqueIssues = (issues: Issue[]): Issue[] => [
  ...new Map(issues.map((issue) => [issueKey(issue), issue])).values(),
];

const summarizeSafely = async (
  summarize: RunDependencies["summarize"],
  issues: Issue[],
  logger: Logger,
): Promise<Map<string, string>> => {
  if (summarize === undefined) {
    return new Map();
  }
  try {
    return await summarize(issues);
  } catch (error) {
    logger.warn(`要約に失敗したため、要約なしで通知します: ${error}`);
    return new Map();
  }
};

/** 新しい Issue を探して LINE に通知し、状態を更新する */
export const run = async ({
  config,
  stateStore,
  searchIssues,
  summarize,
  notifier,
  now,
  logger,
}: RunDependencies): Promise<RunResult> => {
  const checkedAt = now().toISOString();
  const state = await stateStore.load();
  if (state === undefined) {
    await stateStore.save({ lastCheckedAt: checkedAt, notified: [] });
    logger.info("初回実行のため、通知せずに現在時刻を基準として記録しました");
    return "initialized";
  }

  const found: Issue[] = [];
  for (const repository of config.repositories) {
    found.push(...(await searchIssues(repository, state.lastCheckedAt)));
  }
  const notified = new Set(state.notified);
  const issues = uniqueIssues(found).filter(
    (issue) => !notified.has(issueKey(issue)),
  );

  if (issues.length === 0) {
    await stateStore.save(
      advanceState(state, {
        checkedAt,
        notifiedKeys: [],
        maxNotifiedHistory: config.maxNotifiedHistory,
      }),
    );
    logger.info("新しい Issue はありませんでした");
    return "no-new-issues";
  }

  // 送れない場合に要約の費用をかけないよう、要約より先に確認する
  if (!(await notifier.canNotify())) {
    logger.warn(
      `LINE の今月の送信可能数を使い切っているため、${issues.length} 件の通知を見送りました。通数が回復した後にまとめて通知します`,
    );
    return "quota-exceeded";
  }

  const summaries = await summarizeSafely(summarize, issues, logger);
  await notifier.push(
    buildMessage({
      issues,
      summaries,
      bodyPreviewLength: config.bodyPreviewLength,
    }),
  );
  await stateStore.save(
    advanceState(state, {
      checkedAt,
      notifiedKeys: issues.map(issueKey),
      maxNotifiedHistory: config.maxNotifiedHistory,
    }),
  );
  logger.info(`${issues.length} 件の Issue を通知しました`);
  return "notified";
};
