# AI Voice Chat アプリ

音声入力とAI会話機能を備えたWebアプリケーションです。

## 機能

- 音声入力（ブラウザの音声認識API使用）
- 複数AIプロバイダー対応（Gemini、OpenAI、Groq）
- AIVIS Cloud APIによる音声合成


# サーバー起動
node server.js
# または
npm start
```

ローカルでは `http://localhost:3001` でアクセス可能です。

## APIキーの取得

- **Gemini API**: Google AI Studioで取得
- **OpenAI API**: OpenAI プラットフォームで取得
- **Groq API**: Groq コンソールで取得（無料利用可能）
- **AIVIS API**: AIVIS Cloudで取得

## 使用技術

- Node.js / Express
- Web Speech API
- AIVIS Cloud API
- Vanilla JavaScript

## 注意事項

- 音声認識はHTTPS環境でのみ動作します
- 各APIキーは適切に設定してください
- プロダクション環境では環境変数でAPIキーを設定することを推奨します