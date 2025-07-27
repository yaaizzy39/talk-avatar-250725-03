// Vercel Serverless Function for AIVIS API Proxy
export default async function handler(req, res) {
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Preflightリクエストの処理
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { path, method = 'GET', body, headers = {} } = req.body || {};
        
        // リクエストパスの検証
        if (!path) {
            return res.status(400).json({ error: 'pathパラメータが必要です' });
        }

        // AIVIS APIへのリクエスト
        const aivisUrl = `https://api.aivis-project.com${path}`;
        
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

        const response = await fetch(aivisUrl, fetchOptions);
        
        if (!response.ok) {
            return res.status(response.status).json({ 
                error: `AIVIS API Error: ${response.status} ${response.statusText}` 
            });
        }

        // レスポンスの Content-Type を確認
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            res.status(200).json(data);
        } else {
            // 音声データなどのバイナリデータの場合
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', contentType || 'application/octet-stream');
            res.status(200).send(Buffer.from(buffer));
        }

    } catch (error) {
        console.error('プロキシエラー:', error);
        res.status(500).json({ 
            error: 'プロキシサーバーエラー',
            details: error.message 
        });
    }
}