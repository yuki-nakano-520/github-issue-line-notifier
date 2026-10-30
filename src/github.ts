import type { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import type { RepositoryConfig } from "./config.js";
import type { Issue } from "./issue.js";

/** 検索インデックスへの反映の遅れによる取りこぼしを防ぐため、さかのぼって検索する時間 */
export const SEARCH_LOOKBACK_MINUTES = 10;

/** 作成者のアカウントが削除されている場合に GitHub が表示するユーザー名 */
export const DELETED_USER_LOGIN = "ghost";

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const SEARCH_PER_PAGE = 100;

type SearchResultItem =
  RestEndpointMethodTypes["search"]["issuesAndPullRequests"]["response"]["data"]["items"][number];

/** Issue への変換に使う検索結果の項目 */
export type SearchItem = Pick<
  SearchResultItem,
  "number" | "title" | "html_url" | "created_at"
> & {
  /** 型定義では string だが、本文が空の Issue では実際には null が返る */
  body?: string | null | undefined;
  labels: { name?: string | undefined }[];
  user: { login: string } | null;
};

/** 前回の確認時刻から、検索の起点となる時刻(秒単位の ISO 8601)を求める */
export const searchSince = (lastCheckedAt: string): string =>
  new Date(
    new Date(lastCheckedAt).getTime() -
      SEARCH_LOOKBACK_MINUTES * MILLISECONDS_PER_MINUTE,
  )
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

/** 指定ラベルのいずれかが付いた open な Issue のうち、since 以降に更新されたものを探すクエリ */
export const buildSearchQuery = (
  repository: RepositoryConfig,
  since: string,
): string => {
  const labels = repository.labels.map((label) => `"${label}"`).join(",");
  return `repo:${repository.name} is:issue is:open label:${labels} updated:>=${since}`;
};

export const toIssue = (repository: string, item: SearchItem): Issue => ({
  repository,
  number: item.number,
  title: item.title,
  url: item.html_url,
  labels: item.labels
    .map((label) => label.name)
    .filter((name) => name !== undefined),
  author: item.user?.login ?? DELETED_USER_LOGIN,
  createdAt: item.created_at,
  body: item.body ?? "",
});

export const searchIssues = async (
  octokit: Octokit,
  repository: RepositoryConfig,
  lastCheckedAt: string,
): Promise<Issue[]> => {
  const items = await octokit.paginate(
    octokit.rest.search.issuesAndPullRequests,
    {
      q: buildSearchQuery(repository, searchSince(lastCheckedAt)),
      sort: "created",
      order: "asc",
      per_page: SEARCH_PER_PAGE,
    },
  );
  return items.map((item) => toIssue(repository.name, item));
};
