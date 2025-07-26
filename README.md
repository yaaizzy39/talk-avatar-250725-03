# AI Voice Chat アプリ

音声入力とAI会話機能を備えたWebアプリケーションです。

## 機能

- 音声入力（ブラウザの音声認識API使用）
- 複数AIプロバイダー対応（Gemini、OpenAI、Groq）
- AIVIS Cloud APIによる音声合成
- 簡易認証システム

## Railway デプロイメント

### 1. 環境変数の設定

Railway上で以下の環境変数を設定してください：

```
MASTER_PASSWORD=sheep2525
JWT_SECRET=your-random-secret-key-here
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
GROQ_API_KEY=your-groq-api-key
AIVIS_API_KEY=aivis_SmA482mYEy2tQH3UZBKjFnNW9yEM3AaQ
```

### 2. デプロイ手順

1. Railway アカウントを作成
2. 新しいプロジェクトを作成
3. GitHubリポジトリと接続
4. 環境変数を設定
5. デプロイ実行

## ローカル開発

```bash
# 依存関係をインストール
npm install

# 環境変数ファイルを作成
cp .env.example .env

# 環境変数を編集
# .envファイルでAPIキーを設定

# サーバー起動
npm start
```

## APIキーの取得

- **Gemini API**: Google AI Studioで取得
- **OpenAI API**: OpenAI プラットフォームで取得
- **Groq API**: Groq コンソールで取得（無料利用可能）

## 使用技術

- Node.js / Express
- Web Speech API
- AIVIS Cloud API
- Vanilla JavaScript