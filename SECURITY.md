# セキュリティポリシー

## サポートしているバージョン

`main` ブランチの最新の状態のみをサポートしています。テンプレートや fork から作ったリポジトリでは、最新の変更を取り込んでからご確認ください。

## 脆弱性の報告

脆弱性を見つけた場合は、**公開の Issue や Pull Request には書かず**、GitHub の非公開の報告機能から報告してください。

- [脆弱性を報告する](https://github.com/yuki-nakano-520/github-issue-line-notifier/security/advisories/new)

報告には、次の内容を含めていただけると助かります。

- 脆弱性の内容と影響
- 再現の手順
- 影響を受けるファイルや設定

報告の内容は、修正が公開されるまで非公開で扱います。確認でき次第、返信します。

## 認証情報の取り扱いについて

このアプリは、LINE のチャネルアクセストークンや GitHub の Personal Access Token などの認証情報を扱います。

- 認証情報は必ず GitHub Actions の Secrets に保存し、`config.yml` やコードに書かないでください
- `STATE_TOKEN` に使う Fine-grained PAT は、対象を自分のリポジトリだけに絞り、権限は Variables の Read and write のみにしてください
- 認証情報が漏れた可能性がある場合は、すぐに再発行(LINE)や再生成(GitHub)を行い、古い値を無効にしてください
