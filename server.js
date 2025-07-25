const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// AIVIS Cloud APIへのプロキシエンドポイント（ストリーミング対応）
app.post('/api/tts', async (req, res) => {
    try {
        console.log('プロキシサーバー: AIVIS Cloud APIへリクエスト転送');
        console.log('リクエストデータ:', JSON.stringify(req.body, null, 2));
        
        const { text, modelId, quality = 'medium' } = req.body;
        
        // モデルIDの検証
        if (!modelId) {
            return res.status(400).json({
                status: 'error',
                message: 'モデルIDが指定されていません'
            });
        }
        
        console.log('使用するモデルID:', modelId);
        
        // AIVIS Cloud APIの正しいエンドポイント
        const apiUrl = 'https://api.aivis-project.com/v1/tts/synthesize';
        console.log('API URL:', apiUrl);
        
        // リクエストヘッダーの準備
        const headers = {
            'Authorization': 'Bearer aivis_SmA482mYEy2tQH3UZBKjFnNW9yEM3AaQ',
            'Content-Type': 'application/json',
            'User-Agent': 'TextToSpeechApp/1.0'
        };
        
        // リクエストボディの準備（高速化オプション追加）
        const requestBody = {
            model_uuid: modelId,
            text: text,
            use_ssml: true,
            output_format: 'mp3',
            // 高速化のための追加パラメータ（API仕様によって異なる）
            streaming: true,  // ストリーミング有効化
            quality: quality,  // ユーザー設定の品質
            chunk_size: quality === 'low' ? 512 : quality === 'high' ? 2048 : 1024,   // 品質に応じたチャンクサイズ
            optimize_for_latency: quality !== 'high'  // 高品質以外はレイテンシ最適化
        };
        
        console.log('APIに接続を試行中...');
        console.log('リクエストボディ:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        console.log('APIレスポンスステータス:', response.status);
        console.log('APIレスポンスヘッダー:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AIVIS API エラーレスポンス:', errorText);
            throw new Error(`AIVIS API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        // ストリーミングレスポンスの処理
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            // JSONレスポンスの場合
            const data = await response.json();
            console.log('プロキシサーバー: JSONレスポンス受信');
            res.json(data);
        } else if (contentType && contentType.includes('audio/')) {
            // 音声データの場合
            console.log('プロキシサーバー: 音声データをストリーミング中');
            res.set({
                'Content-Type': contentType,
                'Content-Length': response.headers.get('content-length')
            });
            
            // 音声データをそのままクライアントに転送
            response.body.pipe(res);
        } else {
            // その他の場合はテキストとして処理
            const data = await response.text();
            console.log('プロキシサーバー: テキストレスポンス受信');
            res.json({ data: data, status: 'success' });
        }

    } catch (error) {
        console.error('プロキシサーバーエラー:', error);
        res.status(500).json({
            status: 'error',
            message: `プロキシサーバーエラー: ${error.message}`,
            details: error.stack
        });
    }
});

// Google Gemini APIへのプロキシエンドポイント
app.post('/api/chat', async (req, res) => {
    try {
        console.log('プロキシサーバー: Gemini APIへリクエスト転送');
        const { message, apiKey, maxLength = 100 } = req.body;
        
        if (!apiKey) {
            return res.status(400).json({
                status: 'error',
                message: 'Gemini APIキーが設定されていません'
            });
        }

        if (!message) {
            return res.status(400).json({
                status: 'error',
                message: 'メッセージが空です'
            });
        }

        // Google Generative AI インスタンスを作成
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        console.log('Gemini APIにリクエスト送信:', { message: message.substring(0, 50) + '...' });

        // 短い返答を促すプロンプトを追加  
        const prompt = `以下のメッセージに対して、${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。

ユーザーのメッセージ: ${message}`;

        // テキスト生成リクエスト
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('Gemini APIからレスポンス受信:', { responseLength: text.length });

        res.json({
            status: 'success',
            response: text
        });

    } catch (error) {
        console.error('Gemini API エラー:', error);
        res.status(500).json({
            status: 'error',
            message: `Gemini API エラー: ${error.message}`
        });
    }
});

// モデル一覧取得エンドポイント
app.get('/api/models', async (req, res) => {
    try {
        console.log('プロキシサーバー: モデル一覧を取得中');
        
        // AIVIS Hubからモデル一覧を取得を試行（APIが存在すれば）
        // 現在は静的リストを返す
        const models = [
            {
                uuid: 'a59cb814-0083-4369-8542-f51a29e72af7',
                name: 'デフォルトモデル',
                description: '標準的な音声モデル（動作確認済み）',
                voice_type: 'female',
                styles: ['normal'],
                downloads: 0,
                likes: 0
            }
            // 注意: 他のモデルのUUIDが正確でない可能性があります
            // 実際のAIVIS Hubから正しいUUIDを取得する必要があります
        ];

        console.log(`モデル一覧を返送: ${models.length}件`);
        res.json(models);

    } catch (error) {
        console.error('モデル一覧取得エラー:', error);
        res.status(500).json({
            status: 'error',
            message: `モデル一覧の取得に失敗しました: ${error.message}`
        });
    }
});

// ルートアクセス時にindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`プロキシサーバーが起動しました: http://localhost:${PORT}`);
    console.log(`ブラウザで http://localhost:${PORT} にアクセスしてください`);
});