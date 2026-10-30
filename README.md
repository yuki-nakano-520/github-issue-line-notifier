# github-issue-line-notifier

OSS リポジトリに条件に合う Issue が現れたら、LINE に通知する GitHub Actions です。
`good first issue` などのラベルが付いた Issue を見逃さないために使えます。

- 監視するリポジトリとラベルを `config.yml` に書くだけで使えます
- 作成後にラベルが付いた Issue も通知します
- 1 回の実行で見つかった Issue は 1 通にまとめて送ります(LINE の無料枠を節約するため)
- 好きな LLM サービスで、Issue の日本語要約を付けられます(任意)
- サーバーは不要です。GitHub Actions と LINE の無料枠の範囲で動きます

## 通知の例

```text
【新着 Issue】2 件

■ owner/repo
Add Japanese translation
ラベル: good first issue, documentation
作成: @octocat 2026/10/30 21:00
The README is only available in English. It would be great to have...
https://github.com/owner/repo/issues/123

■ owner/other
...
```

## セットアップ

### 1. リポジトリを fork する

このリポジトリを fork します。fork したリポジトリでは Actions の定期実行が止まっているので、**Actions** タブを開いて workflow を有効にしてください。

### 2. LINE の準備

1. LINE 公式アカウントを作成し、LINE Official Account Manager で **Messaging API** を有効にします(詳しくは [Messaging API を始めよう](https://developers.line.biz/ja/docs/messaging-api/getting-started/)を参照)
2. [LINE Developers コンソール](https://developers.line.biz/console/)で、作成されたチャネルを開きます
   - **Messaging API 設定** タブで、**チャネルアクセストークン(長期)** を発行します
   - **チャネル基本設定** タブで、**あなたのユーザー ID** を確認します
3. 作成した公式アカウントを、自分の LINE で友だち追加します(友だちでないと通知が届きません)

### 3. 状態保存用のトークンを作成する

前回どこまで確認したかを Repository variables に保存するため、書き込み権限のあるトークンが必要です。

1. GitHub の [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new) を開きます
2. **Repository access** で、fork したリポジトリだけを選びます
3. **Permissions** で **Variables** を **Read and write** にします
4. トークンを作成します

トークンには有効期限があります。期限が切れると通知が止まるので、更新を忘れないようにしてください。

### 4. Secrets を設定する

fork したリポジトリの **Settings → Secrets and variables → Actions** で、次の Secrets を登録します。

| 名前 | 内容 |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順 2 のチャネルアクセストークン(長期) |
| `LINE_USER_ID` | 手順 2 のユーザー ID |
| `STATE_TOKEN` | 手順 3 のトークン |
| `SUMMARY_API_KEY` | (要約を使う場合のみ)LLM サービスの API キー |

### 5. config.yml を作成する

[config.example.yml](config.example.yml) を `config.yml` という名前でコピーし、監視したいリポジトリとラベルを書いてコミットします。

```yaml
repositories:
  - name: owner/repo
    labels:
      - good first issue
      - help wanted
```

`labels` に書いたラベルのいずれかが付いた、open な Issue が通知の対象です。

### 6. 動作を確認する

**Actions** タブの **Notify new issues** から **Run workflow** で手動実行します。

初回の実行では通知は送らず、その時点を基準として記録します(既存の Issue が大量に届くのを防ぐため)。以降は、基準より後に現れた Issue が通知されます。

## 設定

### config.yml

| 項目 | 内容 | 省略時 |
| --- | --- | --- |
| `repositories[].name` | 監視するリポジトリ(`owner/repo`) | 必須 |
| `repositories[].labels` | 通知対象のラベル(いずれかが付いていれば通知) | 必須 |
| `bodyPreviewLength` | 本文の冒頭を何文字まで表示するか | `100` |
| `maxNotifiedHistory` | 通知済み Issue を何件まで記録するか | `1000` |
| `summary` | 日本語要約の設定(下記) | 無効 |

### 日本語要約(任意)

OpenAI 互換の Chat Completions API に対応したサービス(Gemini、Claude、OpenAI、Ollama など)を使って、Issue の日本語要約を付けられます。

```yaml
summary:
  enabled: true
  baseUrl: https://api.example.com/v1  # サービスの OpenAI 互換 API の URL
  model: model-name                    # 使うモデル名
```

- API キーが必要なサービスでは、Secret `SUMMARY_API_KEY` に設定してください
- 費用は使うサービスによって異なります
- 要約に失敗した場合は、要約なしで通知します

### 実行間隔

[.github/workflows/notify.yml](.github/workflows/notify.yml) の `cron` で変更できます。デフォルトは 30 分ごとです。

- 時刻は UTC です
- private リポジトリでは Actions の無料枠(月 2,000 分)を消費します。30 分ごとならおおむね収まりますが、間隔を短くする場合は注意してください

## 制限事項

- **LINE の送信数**:LINE 公式アカウントの無料プランは、月 200 通程度まで送れます(最新の値は LINE の公式情報を確認してください)。上限に達した月は通知を見送り、翌月の最初の実行で溜まった分をまとめて通知します
- **1 通の文字数**:1 通に収まらない分は「他 N 件」と件数だけ表示します
- **通知の遅れ**:Actions の定期実行は混雑時に遅れることがあるため、通知までに数十分かかる場合があります
- **再通知**:通知済み Issue の記録が上限件数を超えると古いものから消えるため、ずっと前に通知した Issue が更新されると、再び通知されることがあります

## 開発

Node.js 24 以上と pnpm が必要です。

```bash
pnpm install
pnpm check      # Lint・フォーマットの確認
pnpm typecheck  # 型チェック
pnpm test       # テスト
pnpm build      # ビルド
```

要件と設計は [docs/](docs/) にあります。

## ライセンス

[MIT](LICENSE)
