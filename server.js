const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// 認証設定
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'sheep2525';
const JWT_SECRET = process.env.JWT_SECRET || 'voice-app-secret-key-2025';

// APIキー設定（環境変数から取得）
const API_KEYS = {
    gemini: process.env.GEMINI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    aivis: process.env.AIVIS_API_KEY || 'aivis_SmA482mYEy2tQH3UZBKjFnNW9yEM3AaQ'
};

// セッションストア（メモリ内）
const activeSessions = new Set();

// ミドルウェア設定
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 認証ミドルウェア
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || !activeSessions.has(token)) {
        return res.status(401).json({ status: 'error', message: '認証が必要です' });
    }

    next();
}

// ログインエンドポイント
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    if (password !== MASTER_PASSWORD) {
        return res.status(401).json({
            status: 'error',
            message: 'パスワードが正しくありません'
        });
    }

    // セッショントークンを生成
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);

    // 24時間後にトークンを削除
    setTimeout(() => {
        activeSessions.delete(token);
    }, 24 * 60 * 60 * 1000);

    res.json({
        status: 'success',
        token: token,
        expiresIn: 24 * 60 * 60 * 1000 // 24時間（ミリ秒）
    });
});

// ログアウトエンドポイント
app.post('/api/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        activeSessions.delete(token);
    }

    res.json({ status: 'success', message: 'ログアウトしました' });
});

// セッション確認エンドポイント
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ status: 'success', message: '認証済み' });
});

// AIVIS Cloud APIへのプロキシエンドポイント（ストリーミング対応）
app.post('/api/tts', authenticateToken, async (req, res) => {
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
            'Authorization': `Bearer ${API_KEYS.aivis}`,
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

// 複数AI APIへのプロキシエンドポイント
app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { message, provider, model, maxLength = 100 } = req.body;
        console.log(`プロキシサーバー: ${provider} APIへリクエスト転送`);
        
        // サーバー側のAPIキーを使用
        const apiKey = API_KEYS[provider];
        if (!apiKey) {
            return res.status(400).json({
                status: 'error',
                message: `${provider} APIキーがサーバーに設定されていません`
            });
        }

        if (!message) {
            return res.status(400).json({
                status: 'error',
                message: 'メッセージが空です'
            });
        }

        let response;
        
        // プロバイダー別の処理
        switch (provider) {
            case 'gemini':
                response = await handleGeminiRequest(message, apiKey, model, maxLength);
                break;
            case 'openai':
                response = await handleOpenAIRequest(message, apiKey, model, maxLength);
                break;
            case 'groq':
                response = await handleGroqRequest(message, apiKey, model, maxLength);
                break;
            default:
                throw new Error(`未対応のプロバイダー: ${provider}`);
        }

        res.json({
            status: 'success',
            response: response
        });

    } catch (error) {
        console.error(`${req.body.provider || 'AI'} API エラー:`, error);
        res.status(500).json({
            status: 'error',
            message: `AI API エラー: ${error.message}`
        });
    }
});

// Gemini API処理
async function handleGeminiRequest(message, apiKey, model, maxLength) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash-exp' });

    console.log('Gemini APIにリクエスト送信:', { message: message.substring(0, 50) + '...' });

    const prompt = `以下のメッセージに対して、${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。

ユーザーのメッセージ: ${message}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Gemini APIからレスポンス受信:', { responseLength: text.length });
    return text;
}

// OpenAI API処理  
async function handleOpenAIRequest(message, apiKey, model, maxLength) {
    console.log('OpenAI APIにリクエスト送信:', { message: message.substring(0, 50) + '...' });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。`
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: Math.ceil(maxLength * 1.5),
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    console.log('OpenAI APIからレスポンス受信:', { responseLength: text.length });
    return text;
}

// Groq API処理
async function handleGroqRequest(message, apiKey, model, maxLength) {
    console.log('Groq APIにリクエスト送信:', { message: message.substring(0, 50) + '...' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。`
                },
                {
                    role: 'user',
                    content: message
                }
            ],
            max_tokens: Math.ceil(maxLength * 1.5),
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        let errorMessage = `Groq API error: ${response.status}`;
        
        if (errorData.error?.message) {
            errorMessage += ` - ${errorData.error.message}`;
            
            // モデル廃止エラーの場合、推奨モデルを案内
            if (errorData.error.message.includes('decommissioned') || errorData.error.message.includes('deprecated')) {
                errorMessage += '\n推奨モデル: llama-3.1-8b-instant または llama-3.3-70b-versatile をお試しください。';
            }
        }
        
        throw new Error(errorMessage);
    }

    const data = await response.json();
    const text = data.choices[0].message.content;

    console.log('Groq APIからレスポンス受信:', { responseLength: text.length });
    return text;
}

// モデル一覧取得エンドポイント
app.get('/api/models', authenticateToken, async (req, res) => {
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