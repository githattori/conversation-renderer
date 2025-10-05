# Conversation Renderer - ユーザーズマニュアル

## 前提条件
- Python 3.10+
- Node.js 20+ と npm

## クイックスタート
1. リポジトリをクローンして移動します。
2. バックエンド（TypeScript）のコンパイル（サーバーソースの整合性チェック）:
   - リポジトリ直下で以下を実行:
     - `npm ci`
     - `npm run build`
3. Web アプリのビルドとプレビュー:
   - `cd apps/web`
   - `npm ci`
   - `npm run build`
   - `npm run preview -- --port 5173`
   - ブラウザで `http://localhost:5173` を開く。

## Python ツールキット（renderer/）
- 開発依存のインストール: `pip install -r requirements-dev.txt`
- テスト実行: `pytest`

## バックエンド API（Fastify）
- 開発サーバ起動（リポジトリ直下）: `npm run dev`
  - 既定: `http://localhost:3333`

### REST エンドポイント
- POST `/v1/sessions`
  - Body: `{ "role": "analyst" | "facilitator" | "planner" }`（任意・既定は `analyst`）
  - 201 応答: `{ id, role, createdAt }`

- POST `/v1/messages`
  - Body: `{ sessionId: string, content: string, metadata?: object }`
  - 200 応答: `{ diagram: { format, dsl, layout, confidence }, conflicts: string[], diff, systemPrompt }`

- GET `/v1/messages/stream`（WebSocket）
  - 送信 JSON: `{ sessionId, content }`
  - 受信イベント:
    - `{"type":"diagram.update","contract":{...},"diff":{...}}`
    - `{"type":"error","message":"..."}`

- POST `/v1/diagram/format`
  - Body: `{ sessionId: string, format: "mermaid" | "mindmap" }`
  - 200 応答: 要求フォーマットのダイアグラム契約

- POST `/v1/export`
  - Body: `{ sessionId: string }`
  - 200 応答: `{ session, history, contract }`

## Web アプリ（apps/web）
- 開発サーバ: `npm run dev`（Vite）
- ビルド: `npm run build`
- プレビュー: `npm run preview -- --port 5173`

### UI 概要
- Chat Panel: 指示を入力してダイアグラムを生成・更新。
- Preview Panel: Mermaid または Mindmap とレイアウトを描画。
- History Panel: 現在セッションのメッセージ履歴。
- Command Palette: クイック操作と再フォーマット等。

## 典型的なフロー
1. API でセッションを作成、または Web UI から開始。
2. 手順やエンティティを文章で送信。システムがエンティティ抽出・図種判定・契約生成を実施。
3. 繰り返し改善。コンフリクトと差分（diff）を確認。
4. 必要に応じて再フォーマット（`/v1/diagram/format`）やエクスポート（`/v1/export`）。

## トラブルシュート
- TypeScript ビルドエラー: ルートで `npm run build` を実行し、`services/api` 配下の型エラーを修正。
- Web バンドルが大きい警告: ローカル用途では無視可。本番ではコード分割を検討。
- ポート競合: API は `PORT` 環境変数、プレビューは `--port` で調整。

## ライセンス
`README.md` を参照。
