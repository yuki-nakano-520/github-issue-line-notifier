import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const DEFAULT_BODY_PREVIEW_LENGTH = 100;
export const DEFAULT_MAX_NOTIFIED_HISTORY = 1000;
export const DEFAULT_SUMMARY_MODEL = "openai/gpt-4.1-mini";

const repositorySchema = z.object({
  name: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, "owner/repo の形式で指定してください"),
  labels: z.array(z.string().min(1)).min(1),
});

const summarySchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().min(1).default(DEFAULT_SUMMARY_MODEL),
});

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
  summary: summarySchema.prefault({}),
});

export type Config = z.infer<typeof configSchema>;
export type RepositoryConfig = z.infer<typeof repositorySchema>;

export const parseConfig = (text: string): Config => {
  const result = configSchema.safeParse(parseYaml(text));
  if (!result.success) {
    throw new Error(`設定ファイルが不正です\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

export const loadConfig = async (path: string): Promise<Config> =>
  parseConfig(await readFile(path, "utf8"));
