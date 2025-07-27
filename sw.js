// Service Worker for CORS bypass
const CACHE_NAME = 'ai-voice-chat-v1';

// AIVIS API のプロキシ処理
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // AIVIS API へのリクエストを処理
    if (url.hostname === 'api.aivis-project.com') {
        event.respondWith(handleAivisRequest(event.request));
        return;
    }
    
    // その他のリクエストは通常処理
    event.respondWith(fetch(event.request));
});

async function handleAivisRequest(request) {
    try {
        // オリジナルのリクエストを複製
        const modifiedRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: request.body,
            mode: 'cors',
            credentials: 'omit'
        });

        // CORS ヘッダーを追加したレスポンスを返す
        const response = await fetch(modifiedRequest);
        
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: {
                ...response.headers,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });

        return modifiedResponse;
        
    } catch (error) {
        console.error('Service Worker fetch error:', error);
        return new Response(JSON.stringify({ error: 'Service Worker fetch failed' }), {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(self.clients.claim());
});