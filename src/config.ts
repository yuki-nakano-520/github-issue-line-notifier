import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const DEFAULT_BODY_PREVIEW_LENGTH = 100;
export const DEFAULT_MAX_NOTIFIED_HISTORY = 1000;

/** 通知の対象から除外する Issue の条件 */
export type ExcludeConfig = {
  /** Pull Request が紐付いている Issue を除外する */
  linkedPullRequest: boolean;
  /** 担当者が決まっている Issue を除外する */
  assigned: boolean;
};

export const DEFAULT_EXCLUDE: ExcludeConfig = {
  linkedPullRequest: false,
  assigned: false,
};

/** 省略した項目は上位の設定に従う */
const excludeOverrideSchema = z.object({
  linkedPullRequest: z.boolean().optional(),
  assigned: z.boolean().optional(),
});

type ExcludeOverride = z.infer<typeof excludeOverrideSchema>;

const resolveExclude = (
  base: ExcludeConfig,
  override: ExcludeOverride | undefined,
): ExcludeConfig => ({
  linkedPullRequest: override?.linkedPullRequest ?? base.linkedPullRequest,
  assigned: override?.assigned ?? base.assigned,
});

const repositorySchema = z.object({
  name: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, "owner/repo の形式で指定してください"),
  labels: z.array(z.string().min(1)).min(1),
  exclude: excludeOverrideSchema.optional(),
});

const summarySchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    /** OpenAI 互換 API の接続先(例: https://api.example.com/v1) */
    baseUrl: z.url(),
    model: z.string().min(1),
  }),
]);

const configSchema = z.object({
  repositories: z.array(repositorySchema).min(1),
  bodyPreviewLength: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_BODY_PREVIEW_LENGTH),
  maxNotifiedHistory: z
    .number()
    .int()
    .positive()
    .default(DEFAULT_MAX_NOTIFIED_HISTORY),
  summary: summarySchema.default({ enabled: false }),
  exclude: excludeOverrideSchema.optional(),
});

/** リポジトリごとの除外の設定を、全体の設定と既定値で補ったもの */
const resolvedConfigSchema = configSchema.transform(
  ({ exclude, ...config }) => {
    const base = resolveExclude(DEFAULT_EXCLUDE, exclude);
    return {
      ...config,
      repositories: config.repositories.map((repository) => ({
        ...repository,
        exclude: resolveExclude(base, repository.exclude),
      })),
    };
  },
);

export type Config = z.output<typeof resolvedConfigSchema>;
export type RepositoryConfig = Config["repositories"][number];
export type SummaryConfig = Extract<Config["summary"], { enabled: true }>;

export const parseConfig = (text: string): Config => {
  const result = resolvedConfigSchema.safeParse(parseYaml(text));
  if (!result.success) {
    throw new Error(`設定ファイルが不正です\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

export const loadConfig = async (path: string): Promise<Config> =>
  parseConfig(await readFile(path, "utf8"));
