import { Octokit } from "@octokit/rest";
import { loadConfig } from "./config.js";
import { searchIssues } from "./github.js";
import { createLineNotifier } from "./line.js";
import { run } from "./run.js";
import { createStateStore } from "./state.js";
import { summarizeIssues } from "./summary.js";

const DEFAULT_CONFIG_PATH = "config.yml";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const config = await loadConfig(
    process.env.CONFIG_PATH || DEFAULT_CONFIG_PATH,
  );
  const githubOctokit = new Octokit({ auth: requireEnv("GITHUB_TOKEN") });
  const stateOctokit = new Octokit({ auth: requireEnv("STATE_TOKEN") });
  const summaryConfig = config.summary.enabled ? config.summary : undefined;
  const summaryApiKey = process.env.SUMMARY_API_KEY || undefined;

  await run({
    config,
    stateStore: createStateStore(stateOctokit, requireEnv("GITHUB_REPOSITORY")),
    searchIssues: (repository, lastCheckedAt) =>
      searchIssues(githubOctokit, repository, lastCheckedAt),
    summarize:
      summaryConfig === undefined
        ? undefined
        : (issues) =>
            summarizeIssues({
              config: summaryConfig,
              apiKey: summaryApiKey,
              issues,
            }),
    notifier: createLineNotifier({
      channelAccessToken: requireEnv("LINE_CHANNEL_ACCESS_TOKEN"),
      userId: requireEnv("LINE_USER_ID"),
    }),
    now: () => new Date(),
    logger: console,
  });
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
