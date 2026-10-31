# コントリビューションガイド

github-issue-line-notifier に興味を持っていただき、ありがとうございます。
不具合の報告、機能の提案、ドキュメントの改善、コードの修正など、どんなコントリビューションも歓迎します。

参加する前に、[行動規範](CODE_OF_CONDUCT.md)をお読みください。

## はじめる前に

- **小さな修正**(誤字、ドキュメントの改善、明らかな不具合の修正など)は、Issue を作らずに直接 Pull Request を送ってください
- **大きな変更**(新機能、設定項目の追加、設計の変更など)は、作業を始める前に Issue で相談してください。方針が合わずに作業が無駄になるのを防ぐためです
- 初めての方には、[`good first issue`](https://github.com/yuki-nakano-520/github-issue-line-notifier/labels/good%20first%20issue) ラベルの付いた Issue がおすすめです
- 取り組む Issue が決まったら、Issue にコメントしてください。複数の人が同じ作業をするのを防げます

## 不具合の報告・機能の提案

[Issue](https://github.com/yuki-nakano-520/github-issue-line-notifier/issues/new/choose) から、テンプレートを選んで作成してください。

- トークンやユーザー ID などの認証情報は、Issue に書かないでください
- 脆弱性は Issue で公開せず、[セキュリティポリシー](SECURITY.md)の方法で報告してください

## 開発環境の準備

必要なもの:

- Node.js 24 以上
- pnpm(Corepack で有効にできます)

```bash
corepack enable pnpm
```

1. このリポジトリを fork し、手元に clone します
2. 依存パッケージをインストールします

   ```bash
   pnpm install
   ```

   このとき、コミット時に Biome で自動整形する git フック(`.githooks/pre-commit`)も有効になります。

3. 作業用のブランチを作ります(例:`feat/add-xxx`、`fix/xxx`、`docs/xxx`)

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `pnpm check` | Lint とフォーマットの確認(Biome) |
| `pnpm check:fix` | Lint とフォーマットの自動修正 |
| `pnpm typecheck` | 型チェック(テストを含む) |
| `pnpm test` | テスト(Vitest) |
| `pnpm build` | ビルド |

Pull Request を送る前に、`pnpm check`、`pnpm typecheck`、`pnpm test` がすべて通ることを確認してください。CI でも同じチェックを行います。

## プロジェクトの構成

要件は [docs/requirements.md](docs/requirements.md)、設計は [docs/design.md](docs/design.md) にまとめています。コードの構成は設計書の「ディレクトリ構成」を参照してください。

仕様や設計に関わる変更では、あわせてこれらのドキュメントも更新してください。

## コーディング規約

- フォーマットと Lint は Biome に従います(`pnpm check:fix` で自動修正できます)
  - コミット時には、コミットするファイルが自動で整形されます。自動で直せない Lint エラーがある場合は、コミットが中止されます
  - 一部の行だけをステージしたファイルは、整形のときにファイル全体がコミットに含まれます
- TypeScript の `strict` を有効にしています。`any` と `unknown` は使わないでください
- `class` は使わず、関数とオブジェクトで書いてください(`Error` の継承など、どうしても必要な場合を除く)
- 値のハードコードは避け、意味のある名前の定数にしてください

## テスト

- 機能の追加や不具合の修正には、テストを追加してください
- 外部 API(GitHub、LINE、LLM)を呼ぶ処理は、純粋な処理と分けてください。純粋な処理を中心にテストします
- 処理の流れ(`src/run.ts`)のテストでは、外部 API を呼ぶ部品を偽物に差し替えます。実際の API にはアクセスしません

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) の接頭辞に、日本語の説明を続けます。

```text
feat: 要約の設定を接続先とモデル名の指定に変更
```

| 接頭辞 | 用途 |
| --- | --- |
| `feat` | 機能の追加・変更 |
| `fix` | 不具合の修正 |
| `docs` | ドキュメントのみの変更 |
| `test` | テストのみの追加・修正 |
| `refactor` | 動作を変えないコードの整理 |
| `chore` | 設定・依存パッケージ・ツールなどの変更 |
| `ci` | CI・workflow の変更 |

Pull Request は squash merge するので、ブランチ内の各コミットは厳密でなくても構いません。**Pull Request のタイトル**をこの形式にしてください。

## Pull Request

1. fork したリポジトリの作業ブランチから、このリポジトリの `main` に Pull Request を送ります
2. テンプレートに沿って、変更の内容と確認したことを書いてください
3. CI が成功し、メンテナーのレビューで承認されたらマージします(squash merge)

レビューで修正をお願いすることがあります。気軽にやり取りしてください。

## 実際の環境での動作確認(任意)

LINE への通知まで確かめたい場合は、[README](README.md) のセットアップ手順に沿って、fork したリポジトリで Secrets と `config.yml` を設定してください。`config.yml` と認証情報は、Pull Request に含めないでください。

## ライセンス

コントリビューションは、このリポジトリと同じ [MIT ライセンス](LICENSE)で提供されるものとします。
