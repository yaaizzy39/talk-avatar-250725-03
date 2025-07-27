const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, '../dist')));

// AIVIS API プロキシエンドポイント
app.post('/api/aivis-proxy', async (req, res) => {
    try {
        const { path: apiPath, method = 'GET', body, headers = {} } = req.body;
        
        if (!apiPath) {
            return res.status(400).json({ error: 'pathパラメータが必要です' });
        }

        const aivisUrl = `https://api.aivis-project.com${apiPath}`;
        
        const fetchOptions = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (method !== 'GET' && body) {
            fetchOptions.body = JSON.stringify(body);
        }

        console.log(`プロキシリクエスト: ${method} ${aivisUrl}`);
        
        const response = await fetch(aivisUrl, fetchOptions);
        
        if (!response.ok) {
            console.error(`AIVIS API エラー: ${response.status} ${response.statusText}`);
            return res.status(response.status).json({ 
                error: `AIVIS API Error: ${response.status} ${response.statusText}` 
            });
        }

        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.json(data);
        } else {
            // 音声データなどのバイナリデータ
            const buffer = await response.buffer();
            res.set('Content-Type', contentType || 'application/octet-stream');
            res.send(buffer);
        }

    } catch (error) {
        console.error('プロキシエラー:', error);
        res.status(500).json({ 
            error: 'プロキシサーバーエラー',
            details: error.message 
        });
    }
});

// SPAのためのフォールバック
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`プロキシサーバーがポート ${PORT} で起動しました`);
    });
}

module.exports = app;