export type Issue = {
  repository: string;
  number: number;
  title: string;
  url: string;
  labels: string[];
  author: string;
  createdAt: string;
  body: string;
};

/** 通知済みの記録などで Issue を識別するキー(例: owner/repo#123) */
export const issueKey = (issue: Pick<Issue, "repository" | "number">): string =>
  `${issue.repository}#${issue.number}`;
