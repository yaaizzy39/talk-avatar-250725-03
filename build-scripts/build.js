const fs = require('fs');
const path = require('path');

// distディレクトリを作成
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 静的ファイルをコピー
const filesToCopy = [
    'index.html',
    'style.css',
    'script-static.js'
];

filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, '..', file);
    const destPath = path.join(distDir, file);
    
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`コピー完了: ${file}`);
    } else {
        console.warn(`ファイルが見つかりません: ${file}`);
    }
});

// script-static.js を修正してプロキシURLを調整
const scriptPath = path.join(distDir, 'script-static.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// プロキシURLを現在のドメインに設定
scriptContent = scriptContent.replace(
    /getProxyUrl\(\) \{[\s\S]*?\}/,
    `getProxyUrl() {
        // 静的ホスティングの場合は同じオリジンを使用
        return window.location.origin;
    }`
);

fs.writeFileSync(scriptPath, scriptContent);
console.log('script-static.js のプロキシURL設定を更新しました');

// package.json から必要な情報を読み取り、プロキシサーバーも配置
const proxyServerSrc = path.join(__dirname, 'proxy-server.js');
const proxyServerDest = path.join(distDir, 'server.js');
fs.copyFileSync(proxyServerSrc, proxyServerDest);

// プロキシサーバー用のpackage.jsonを作成
const proxyPackageJson = {
    "name": "ai-voice-chat-proxy",
    "version": "1.0.0",
    "description": "AI Voice Chat with Proxy Server",
    "main": "server.js",
    "scripts": {
        "start": "node server.js"
    },
    "dependencies": {
        "express": "^4.18.2",
        "cors": "^2.8.5",
        "node-fetch": "^2.6.7"
    }
};

fs.writeFileSync(
    path.join(distDir, 'package.json'), 
    JSON.stringify(proxyPackageJson, null, 2)
);

console.log('ビルド完了！');
console.log('出力ディレクトリ:', distDir);