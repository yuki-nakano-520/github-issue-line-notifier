import type { Octokit } from "@octokit/rest";
import { z } from "zod";

export const STATE_VARIABLE_NAME = "ISSUE_LINE_NOTIFIER_STATE";

const HTTP_NOT_FOUND = 404;

const stateSchema = z.object({
  /** 前回、正常に確認を終えた実行の開始時刻 */
  lastCheckedAt: z.iso.datetime(),
  /** 通知済み Issue のキー(古い順) */
  notified: z.array(z.string()),
});

export type State = z.infer<typeof stateSchema>;

export const parseState = (text: string): State => {
  const result = stateSchema.safeParse(JSON.parse(text));
  if (!result.success) {
    throw new Error(
      `Repository variable ${STATE_VARIABLE_NAME} の内容が不正です\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
};

export const serializeState = (state: State): string => JSON.stringify(state);

type AdvanceStateOptions = {
  checkedAt: string;
  notifiedKeys: string[];
  maxNotifiedHistory: number;
};

/**
 * 確認時刻を進め、通知した Issue を記録に追加する。
 * 記録が maxNotifiedHistory 件を超えたら古いものから削除する。
 */
export const advanceState = (
  state: State,
  { checkedAt, notifiedKeys, maxNotifiedHistory }: AdvanceStateOptions,
): State => {
  const known = new Set(state.notified);
  const added = notifiedKeys.filter((key) => !known.has(key));
  return {
    lastCheckedAt: checkedAt,
    notified: [...state.notified, ...added].slice(-maxNotifiedHistory),
  };
};

const isNotFoundError = (error: Error): boolean =>
  "status" in error && error.status === HTTP_NOT_FOUND;

export type StateStore = {
  /** 状態がまだ保存されていない(初回実行)場合は undefined を返す */
  load: () => Promise<State | undefined>;
  save: (state: State) => Promise<void>;
};

/**
 * Repository variable に状態を保存するストアを作る。
 * @param repository 状態を保存するリポジトリ(owner/repo)
 */
export const createStateStore = (
  octokit: Octokit,
  repository: string,
): StateStore => {
  const [owner, repo, ...rest] = repository.split("/");
  if (!owner || !repo || rest.length > 0) {
    throw new Error(
      `リポジトリは owner/repo の形式で指定してください: ${repository}`,
    );
  }
  const params = { owner, repo, name: STATE_VARIABLE_NAME };

  return {
    load: async () => {
      try {
        const { data } = await octokit.rest.actions.getRepoVariable(params);
        return parseState(data.value);
      } catch (error) {
        if (error instanceof Error && isNotFoundError(error)) {
          return undefined;
        }
        throw error;
      }
    },
    save: async (state) => {
      const value = serializeState(state);
      try {
        await octokit.rest.actions.updateRepoVariable({ ...params, value });
      } catch (error) {
        if (error instanceof Error && isNotFoundError(error)) {
          await octokit.rest.actions.createRepoVariable({ ...params, value });
          return;
        }
        throw error;
      }
    },
  };
};
