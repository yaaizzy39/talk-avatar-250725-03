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
        
        const { text, modelId } = req.body;
        
        // AIVIS Cloud APIの正しいエンドポイント
        const apiUrl = 'https://api.aivis-project.com/v1/tts/synthesize';
        console.log('API URL:', apiUrl);
        
        // リクエストヘッダーの準備
        const headers = {
            'Authorization': 'Bearer aivis_SmA482mYEy2tQH3UZBKjFnNW9yEM3AaQ',
            'Content-Type': 'application/json',
            'User-Agent': 'TextToSpeechApp/1.0'
        };
        
        // リクエストボディの準備
        const requestBody = {
            model_uuid: modelId,
            text: text,
            use_ssml: true,
            output_format: 'mp3'
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
        const { message, apiKey } = req.body;
        
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

        // テキスト生成リクエスト
        const result = await model.generateContent(message);
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

// ルートアクセス時にindex.htmlを返す
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`プロキシサーバーが起動しました: http://localhost:${PORT}`);
    console.log(`ブラウザで http://localhost:${PORT} にアクセスしてください`);
});