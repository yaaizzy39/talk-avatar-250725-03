// 環境変数を読み込み
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Render環境用：プロキシ設定
app.set('trust proxy', true);

// 認証設定
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'default-password-change-me';
const JWT_SECRET = process.env.JWT_SECRET || 'voice-app-secret-key-2025';

// 本番環境用：デバッグログ削除済み

// APIキー設定（環境変数から取得）
const API_KEYS = {
    gemini: process.env.GEMINI_API_KEY || '',
    openai: process.env.OPENAI_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    aivis: process.env.AIVIS_API_KEY || ''
};

// セッションストア（メモリ内）- 延長型セッション管理
const activeSessions = new Map(); // token -> { expires: timestamp, timer: timeoutId }
const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // 3日間（ミリ秒）

// セッション管理関数
function createSession(token) {
    const expires = Date.now() + SESSION_DURATION;
    const timer = setTimeout(() => {
        activeSessions.delete(token);
    }, SESSION_DURATION);
    
    activeSessions.set(token, { expires, timer });
}

function extendSession(token) {
    const session = activeSessions.get(token);
    if (session) {
        // 既存のタイマーをクリア
        clearTimeout(session.timer);
        
        // 新しい有効期限とタイマーを設定
        const expires = Date.now() + SESSION_DURATION;
        const timer = setTimeout(() => {
            activeSessions.delete(token);
        }, SESSION_DURATION);
        
        activeSessions.set(token, { expires, timer });
        return true;
    }
    return false;
}

function isValidSession(token) {
    return activeSessions.has(token);
}

// セキュリティヘッダーを追加
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", "blob:", "data:"], // 音声再生用にblob追加
            connectSrc: ["'self'", "https://api.openai.com", "https://api.groq.com", "https://generativelanguage.googleapis.com", "https://api.aivis-project.com"],
        },
    },
}));

// レート制限を設定（Render対応）
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true, // Render環境用
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1分
    max: 20, // 最大20リクエスト
    message: 'Too many API requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true, // Render環境用
});

app.use(generalLimiter);

// ミドルウェア設定
// CORS設定を制限
app.use(cors({
    origin: function (origin, callback) {
        // 開発環境とプロダクション環境のオリジンを許可
        const allowedOrigins = [
            'http://localhost:3001',
            'http://127.0.0.1:3001',
            'https://ai-voice-chat-v03.onrender.com', // 確実なURL
            process.env.ALLOWED_ORIGIN // 環境変数で本番ドメインを設定
        ].filter(Boolean); // undefined値を除外

        console.log('CORS チェック - Origin:', origin);
        console.log('CORS チェック - Allowed:', allowedOrigins);

        // オリジンなし（Postmanなど）またはホワイトリストにあるオリジンを許可
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error('CORS violation - Origin not allowed:', origin);
            callback(new Error('CORS policy violation'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' })); // JSONサイズ制限を追加
app.use(express.static('.'));


// 認証ミドルウェア（セッション延長付き）
function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        console.log('🔐 認証チェック:', {
            hasAuthHeader: !!authHeader,
            hasToken: !!token,
            activeSessions: activeSessions.size,
            tokenValid: token ? isValidSession(token) : false
        });

        if (!token) {
            console.log('❌ トークンなし');
            return res.status(401).json({
                status: 'error',
                message: '認証トークンが必要です'
            });
        }

        if (!isValidSession(token)) {
            console.log('❌ 無効なトークン:', token.substring(0, 10) + '...');
            return res.status(401).json({
                status: 'error',
                message: '無効な認証トークンです'
            });
        }

        // セッションを延長
        extendSession(token);
        console.log('✅ 認証成功 & セッション延長');
        next();
    } catch (error) {
        console.error('🚨 認証エラー:', error);
        return res.status(500).json({
            status: 'error',
            message: 'サーバー内部エラー'
        });
    }
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
    createSession(token);

    console.log('🔑 ログイン成功:', {
        password: password === MASTER_PASSWORD ? '✅正解' : '❌間違い',
        tokenGenerated: token.substring(0, 10) + '...',
        sessionCount: activeSessions.size
    });

    res.json({
        status: 'success',
        token: token,
        expiresIn: SESSION_DURATION // 3日間（ミリ秒）
    });
});

// ログアウトエンドポイント
app.post('/api/logout', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token && activeSessions.has(token)) {
        // タイマーをクリアしてセッションを削除
        const session = activeSessions.get(token);
        if (session.timer) {
            clearTimeout(session.timer);
        }
        activeSessions.delete(token);
    }

    res.json({ status: 'success', message: 'ログアウトしました' });
});

// セッション確認エンドポイント
app.get('/api/verify', authenticateToken, (req, res) => {
    res.json({ status: 'success', message: '認証済み' });
});


// APIキー接続テストエンドポイント
app.post('/api/test-api-key', apiLimiter, authenticateToken, async (req, res) => {
    try {
        const { provider, apiKey } = req.body;
        
        if (!provider || !apiKey) {
            return res.status(400).json({
                status: 'error',
                message: 'プロバイダーとAPIキーが必要です'
            });
        }

        let testResult;
        
        // プロバイダー別のテスト処理
        switch (provider) {
            case 'gemini':
                testResult = await testGeminiApiKey(apiKey);
                break;
            case 'openai':
                testResult = await testOpenAIApiKey(apiKey);
                break;
            case 'groq':
                testResult = await testGroqApiKey(apiKey);
                break;
            case 'aivis':
                testResult = await testAivisApiKey(apiKey);
                break;
            default:
                throw new Error(`未対応のプロバイダー: ${provider}`);
        }

        res.json({
            status: 'success',
            provider: provider,
            valid: testResult.valid,
            message: testResult.message
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: `APIキーテストに失敗しました: ${error.message}`
        });
    }
});

// AIVIS Cloud APIへのプロキシエンドポイント（ストリーミング対応）
app.post('/api/tts', apiLimiter, authenticateToken, async (req, res) => {
    try {
        
        const { text, modelId, quality = 'medium', apiKeys = {} } = req.body;
        
        // 入力値検証
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'テキストが必要です'
            });
        }
        
        if (text.length > 5000) {
            return res.status(400).json({
                status: 'error',
                message: 'テキストは5000文字以内で入力してください'
            });
        }
        
        // モデルIDの検証
        if (!modelId || typeof modelId !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'モデルIDが指定されていません'
            });
        }
        
        
        // AIVIS Cloud APIの正しいエンドポイント
        const apiUrl = 'https://api.aivis-project.com/v1/tts/synthesize';
        
        // ユーザーのAPIキーを優先、なければサーバー側のAPIキーを使用
        const aivisApiKey = apiKeys.aivis || API_KEYS.aivis;
        
        if (!aivisApiKey) {
            return res.status(400).json({
                status: 'error',
                message: 'AIVIS APIキーが設定されていません。設定画面でAPIキーを入力してください。'
            });
        }
        

        // リクエストヘッダーの準備
        const headers = {
            'Authorization': `Bearer ${aivisApiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'TextToSpeechApp/1.0'
        };
        
        // リクエストボディの準備（デモページと同じ設定）
        const requestBody = {
            model_uuid: modelId,
            text: text,
            use_ssml: true,
            output_format: 'mp3'
        };
        
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        
        // エラーレスポンスの処理
        if (!response.ok) {
            // エラーレスポンスの詳細を取得
            let errorDetails = '';
            try {
                const errorText = await response.text();
                errorDetails = errorText;
            } catch (e) {
                // エラー詳細の取得に失敗
            }
            
            return res.status(response.status).json({
                status: 'error',
                message: `AIVIS API error: ${response.status} ${response.statusText}`,
                details: errorDetails
            });
        }
        
        // Content-Typeの詳細確認
        const responseContentType = response.headers.get('content-type');

        // Render対応: ストリーミングではなくバッファ処理
        const contentType = responseContentType;
        
        if (contentType && contentType.includes('application/json')) {
            // JSONレスポンスの場合
            const data = await response.json();
            res.json(data);
        } else if (contentType && contentType.includes('audio/')) {
            // 音声データの場合 - Render対応でバッファ処理
            
            // 音声データを一度バッファに読み込んでから送信
            const audioBuffer = await response.arrayBuffer();
            
            res.set({
                'Content-Type': contentType,
                'Content-Length': audioBuffer.byteLength
            });
            
            // バッファしたデータを送信
            res.send(Buffer.from(audioBuffer));
        } else {
            // その他の場合はテキストとして処理
            const data = await response.text();
            res.json({ data: data, status: 'success' });
        }

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: `プロキシサーバーエラー: ${error.message}`,
            details: error.stack
        });
    }
});

// 複数AI APIへのプロキシエンドポイント
app.post('/api/chat', apiLimiter, authenticateToken, async (req, res) => {
    try {
        const { message, provider, model, maxLength = 100, apiKeys = {}, characterSetting = '' } = req.body;
        
        // 入力値検証
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                status: 'error',
                message: 'メッセージが必要です'
            });
        }
        
        if (message.length > 2000) {
            return res.status(400).json({
                status: 'error',
                message: 'メッセージは2000文字以内で入力してください'
            });
        }
        
        if (!provider || !['gemini', 'openai', 'groq'].includes(provider)) {
            return res.status(400).json({
                status: 'error',
                message: '有効なプロバイダーを指定してください'
            });
        }
        
        // クライアントから送信されたAPIキーを優先、なければサーバー側のAPIキーを使用
        const apiKey = apiKeys[provider] || API_KEYS[provider];
        if (!apiKey) {
            return res.status(400).json({
                status: 'error',
                message: `${provider} APIキーが設定されていません。設定画面でAPIキーを入力してください。`
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
                response = await handleGeminiRequest(message, apiKey, model, maxLength, characterSetting);
                break;
            case 'openai':
                response = await handleOpenAIRequest(message, apiKey, model, maxLength, characterSetting);
                break;
            case 'groq':
                response = await handleGroqRequest(message, apiKey, model, maxLength, characterSetting);
                break;
            default:
                throw new Error(`未対応のプロバイダー: ${provider}`);
        }

        res.json({
            status: 'success',
            response: response
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: `AI API エラー: ${error.message}`
        });
    }
});

// Gemini API処理
async function handleGeminiRequest(message, apiKey, model, maxLength, characterSetting = '') {
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model: model || 'gemini-2.0-flash-exp' });


    // キャラクター設定をプロンプトに組み込み
    let characterPrompt = '';
    if (characterSetting.trim()) {
        characterPrompt = `あなたは次のキャラクター設定に従って返答してください: ${characterSetting}\n\n`;
    }

    const prompt = `${characterPrompt}以下のメッセージに対して、${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。

ユーザーのメッセージ: ${message}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return text;
}

// OpenAI API処理  
async function handleOpenAIRequest(message, apiKey, model, maxLength, characterSetting = '') {

    // キャラクター設定をシステムプロンプトに組み込み
    let systemContent = `${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。`;
    if (characterSetting.trim()) {
        systemContent = `あなたは次のキャラクター設定に従って返答してください: ${characterSetting}\n\n${systemContent}`;
    }

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
                    content: systemContent
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

    return text;
}

// Groq API処理
async function handleGroqRequest(message, apiKey, model, maxLength, characterSetting = '') {

    // キャラクター設定をシステムプロンプトに組み込み
    let systemContent = `${maxLength}文字以内の簡潔で親しみやすい返答をしてください。長い説明は避けて、要点だけを伝えてください。`;
    if (characterSetting.trim()) {
        systemContent = `あなたは次のキャラクター設定に従って返答してください: ${characterSetting}\n\n${systemContent}`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model || 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: systemContent
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

    return text;
}

// APIキーテスト関数群
async function testGeminiApiKey(apiKey) {
    try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const result = await model.generateContent('Hello');
        const response = await result.response;
        const text = response.text();
        
        return {
            valid: true,
            message: 'Gemini API接続成功'
        };
    } catch (error) {
        return {
            valid: false,
            message: `Gemini API接続失敗: ${error.message}`
        };
    }
}

async function testOpenAIApiKey(apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            })
        });

        if (response.ok) {
            return {
                valid: true,
                message: 'OpenAI API接続成功'
            };
        } else {
            const errorData = await response.json();
            return {
                valid: false,
                message: `OpenAI API接続失敗: ${errorData.error?.message || 'Unknown error'}`
            };
        }
    } catch (error) {
        return {
            valid: false,
            message: `OpenAI API接続失敗: ${error.message}`
        };
    }
}

async function testGroqApiKey(apiKey) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Hello' }],
                max_tokens: 10
            })
        });

        if (response.ok) {
            return {
                valid: true,
                message: 'Groq API接続成功'
            };
        } else {
            const errorData = await response.json();
            return {
                valid: false,
                message: `Groq API接続失敗: ${errorData.error?.message || 'Unknown error'}`
            };
        }
    } catch (error) {
        return {
            valid: false,
            message: `Groq API接続失敗: ${error.message}`
        };
    }
}

async function testAivisApiKey(apiKey) {
    try {
        const requestBody = {
            model_uuid: 'a59cb814-0083-4369-8542-f51a29e72af7',
            text: 'テスト',
            use_ssml: true,
            output_format: 'mp3'
        };
        
        const response = await fetch('https://api.aivis-project.com/v1/tts/synthesize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        

        if (response.ok) {
            return {
                valid: true,
                message: 'AIVIS API接続成功'
            };
        } else {
            const errorData = await response.text();
            return {
                valid: false,
                message: `AIVIS API接続失敗: ${response.status} - ${errorData}`
            };
        }
    } catch (error) {
        return {
            valid: false,
            message: `AIVIS API接続失敗: ${error.message}`
        };
    }
}

// モデル一覧取得エンドポイント
app.get('/api/models', authenticateToken, async (req, res) => {
    try {
        
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

        res.json(models);

    } catch (error) {
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
    console.log(`🚀 サーバー起動成功: Port ${PORT}`);
    console.log(`📝 MASTER_PASSWORD設定: ${MASTER_PASSWORD ? '✅' : '❌'}`);
    console.log(`🌐 ALLOWED_ORIGIN設定: ${process.env.ALLOWED_ORIGIN || 'なし'}`);
    console.log(`📅 現在時刻: ${new Date().toISOString()}`);
});