import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const DEFAULT_BODY_PREVIEW_LENGTH = 100;
export const DEFAULT_MAX_NOTIFIED_HISTORY = 1000;

const repositorySchema = z.object({
  name: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, "owner/repo の形式で指定してください"),
  labels: z.array(z.string().min(1)).min(1),
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
});

export type Config = z.infer<typeof configSchema>;
export type RepositoryConfig = z.infer<typeof repositorySchema>;
export type SummaryConfig = Extract<Config["summary"], { enabled: true }>;

export const parseConfig = (text: string): Config => {
  const result = configSchema.safeParse(parseYaml(text));
  if (!result.success) {
    throw new Error(`設定ファイルが不正です\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

export const loadConfig = async (path: string): Promise<Config> =>
  parseConfig(await readFile(path, "utf8"));
