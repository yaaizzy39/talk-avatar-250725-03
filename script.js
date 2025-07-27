class TextToSpeechApp {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.chatHistory = [];
        // AI設定値の初期化
        this.currentAiProvider = localStorage.getItem('ai_provider') || 'groq';
        this.audioContext = null;
        this.audioSource = null;
        this.gainNode = null;
        this.audioCache = new Map(); // 音声キャッシュ
        this.authToken = localStorage.getItem('auth_token') || null;
        this.checkAuthentication();
    }

    async checkAuthentication() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        // 認証をバイパス - 常にメインアプリを表示
        console.log('認証をバイパスしてメインアプリを表示します');
        
        // ダミートークンを設定（サーバー側で実際の認証は無効化済み）
        if (!this.authToken) {
            this.authToken = 'dummy-token-for-bypass';
            localStorage.setItem('auth_token', this.authToken);
        }
        
        loginScreen.style.display = 'none';
        mainApp.style.display = 'block';
        this.initializeMainApp();
    }

    showLoginScreen() {
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        loginScreen.style.display = 'flex';
        mainApp.style.display = 'none';
        
        // ログインイベントリスナー
        const loginBtn = document.getElementById('loginBtn');
        const loginPassword = document.getElementById('loginPassword');
        const loginError = document.getElementById('loginError');
        
        const handleLogin = async () => {
            const password = loginPassword.value;
            
            if (!password) {
                this.showLoginError('パスワードを入力してください');
                return;
            }
            
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password })
                });
                
                const result = await response.json();
                
                if (result.status === 'success') {
                    this.authToken = result.token;
                    localStorage.setItem('auth_token', this.authToken);
                    
                    loginScreen.style.display = 'none';
                    mainApp.style.display = 'block';
                    this.initializeMainApp();
                } else {
                    this.showLoginError(result.message || 'ログインに失敗しました');
                }
            } catch (error) {
                console.error('ログインエラー:', error);
                this.showLoginError('ログインに失敗しました');
            }
        };
        
        loginBtn.onclick = handleLogin;
        loginPassword.onkeypress = (e) => {
            if (e.key === 'Enter') {
                handleLogin();
            }
        };
    }

    showLoginError(message) {
        const loginError = document.getElementById('loginError');
        loginError.textContent = message;
        loginError.style.display = 'block';
    }

    initializeMainApp() {
        this.initializeElements();
        this.attachEventListeners();
        this.updateSliderValues();
        this.loadSettings();
        this.loadApiKeys(); // APIキーを読み込み
        this.loadAvailableModels();
        this.switchAiProvider(); // 初期のプロバイダー設定
    }


    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.chatHistoryEl = document.getElementById('chatHistory');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelInfo = document.getElementById('modelInfo');
        this.customModelId = document.getElementById('customModelId');
        this.addModelBtn = document.getElementById('addModelBtn');
        this.availableModels = [];
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.maxLength = document.getElementById('maxLength');
        this.audioQuality = document.getElementById('audioQuality');
        
        // APIキー入力要素
        this.geminiApiKey = document.getElementById('geminiApiKey');
        this.openaiApiKey = document.getElementById('openaiApiKey');
        this.groqApiKey = document.getElementById('groqApiKey');
        this.aivisApiKey = document.getElementById('aivisApiKey');
        this.geminiStatus = document.getElementById('geminiStatus');
        this.openaiStatus = document.getElementById('openaiStatus');
        this.groqStatus = document.getElementById('groqStatus');
        this.aivisStatus = document.getElementById('aivisStatus');
        
        // 音声入力要素の初期化
        this.voiceInputBtn = document.getElementById('voiceInputBtn');
        this.continuousVoiceBtn = document.getElementById('continuousVoiceBtn');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.recognition = null;
        this.continuousRecognition = null;
        this.isListening = false;
        this.isContinuousMode = false;
        this.initializeSpeechRecognition();
        
        // 設定変更の監視
        this.maxLength.addEventListener('input', () => {
            this.saveSettings();
        });
        
        this.audioQuality.addEventListener('change', () => {
            this.saveSettings();
        });
        // AI設定要素
        this.aiProvider = document.getElementById('aiProvider');
        this.openaiModel = document.getElementById('openaiModel');
        this.groqModel = document.getElementById('groqModel');
        
        // キャラクター設定
        this.characterSetting = document.getElementById('characterSetting');
        this.apiStatus = document.getElementById('apiStatus');
        this.stopBtn = document.getElementById('stopBtn');
        this.stopContinuousBtn = document.getElementById('stopContinuousBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
    }

    attachEventListeners() {
        // テキスト入力の文字数カウント
        this.textInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        // メッセージ送信
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // 履歴クリア
        this.clearBtn.addEventListener('click', () => {
            this.clearChatHistory();
        });

        // AIプロバイダー選択
        this.aiProvider.addEventListener('change', () => {
            this.switchAiProvider();
        });


        // モデル選択変更
        this.modelSelect.addEventListener('change', () => {
            this.updateModelInfo();
            this.saveSettings();
        });


        // Aivis音声モデルサイトボタン
        this.aivisModelSiteBtn = document.getElementById('aivisModelSiteBtn');
        this.aivisModelSiteBtn.addEventListener('click', () => {
            window.open('https://hub.aivis-project.com/search?_gl=1*1v1mldo*_ga*MjA0MjI5OTQ4My4xNzUzNTAzMjk4*_ga_TEMWCS6D7B*czE3NTM1MDMyOTgkbzEkZzEkdDE3NTM1MDMzODQkajYwJGwwJGgw', '_blank');
        });

        // AIVIS APIキー取得サイトボタン
        this.aivisSiteBtn = document.getElementById('aivisSiteBtn');
        this.aivisSiteBtn.addEventListener('click', () => {
            window.open('https://hub.aivis-project.com/cloud-api/api-keys', '_blank');
        });

        this.groqSiteBtn = document.getElementById('groqSiteBtn');
        this.groqSiteBtn.addEventListener('click', () => {
            window.open('https://console.groq.com/keys', '_blank');
        });

        // カスタムモデル追加
        this.addModelBtn.addEventListener('click', () => {
            this.addCustomModel();
        });

        // モデル選択変更時の保存
        this.openaiModel.addEventListener('change', () => {
            this.saveModel('openai', this.openaiModel.value);
        });

        this.groqModel.addEventListener('change', () => {
            this.saveModel('groq', this.groqModel.value);
        });

        // キャラクター設定変更時の保存
        this.characterSetting.addEventListener('input', () => {
            this.saveCharacterSetting(this.characterSetting.value);
        });

        // プリセットボタン
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                this.characterSetting.value = preset;
                this.saveCharacterSetting(preset);
            });
        });

        // スライダーの値更新
        this.speedSlider.addEventListener('input', () => {
            this.speedValue.textContent = this.speedSlider.value;
            if (this.currentAudio) {
                this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            }
            this.saveSettings();
        });

        this.volumeSlider.addEventListener('input', () => {
            this.volumeValue.textContent = this.volumeSlider.value;
            if (this.currentAudio) {
                this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            }
            this.saveSettings();
        });

        // 音声停止ボタン
        this.stopBtn.addEventListener('click', () => {
            this.stopSpeech();
        });

        // 音声入力ボタン
        this.voiceInputBtn.addEventListener('click', () => {
            this.toggleVoiceInput();
        });

        // 常時待機モードボタン
        this.continuousVoiceBtn.addEventListener('click', () => {
            this.toggleContinuousMode();
        });

        // 常時待機停止ボタン
        this.stopContinuousBtn.addEventListener('click', () => {
            this.stopContinuousMode();
        });

        // APIキー入力イベント
        this.geminiApiKey.addEventListener('input', () => {
            this.saveApiKey('gemini', this.geminiApiKey.value);
            this.updateApiStatus('gemini');
        });

        this.openaiApiKey.addEventListener('input', () => {
            this.saveApiKey('openai', this.openaiApiKey.value);
            this.updateApiStatus('openai');
        });

        this.groqApiKey.addEventListener('input', () => {
            this.saveApiKey('groq', this.groqApiKey.value);
            this.updateApiStatus('groq');
        });

        this.aivisApiKey.addEventListener('input', () => {
            this.saveApiKey('aivis', this.aivisApiKey.value);
            this.updateApiStatus('aivis');
        });

        // 接続テストボタンイベント
        document.getElementById('testGeminiBtn').addEventListener('click', () => {
            this.testApiConnection('gemini');
        });

        document.getElementById('testOpenaiBtn').addEventListener('click', () => {
            this.testApiConnection('openai');
        });

        document.getElementById('testGroqBtn').addEventListener('click', () => {
            this.testApiConnection('groq');
        });

        document.getElementById('testAivisBtn').addEventListener('click', () => {
            this.testApiConnection('aivis');
        });

        // キーボードショートカット
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    updateCharacterCount() {
        const length = this.textInput.value.length;
        this.charCount.textContent = length;
    }


    switchAiProvider() {
        const provider = this.aiProvider.value;
        this.currentAiProvider = provider;
        localStorage.setItem('ai_provider', provider);

        // 全てのパネルを非表示
        document.getElementById('geminiConfig').style.display = 'none';
        document.getElementById('openaiConfig').style.display = 'none';
        document.getElementById('groqConfig').style.display = 'none';

        // 選択されたプロバイダーのパネルを表示
        document.getElementById(`${provider}Config`).style.display = 'block';
        
        this.updateApiStatus();
    }


    getCurrentModel() {
        switch (this.currentAiProvider) {
            case 'gemini': return 'gemini-2.0-flash-exp';
            case 'openai': return this.openaiModel.value || 'gpt-4o-mini';
            case 'groq': 
                const groqModel = this.groqModel.value || 'llama-3.3-70b-versatile';
                // 許可されていないモデルの場合はデフォルトに戻す
                if (!['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'].includes(groqModel)) {
                    this.groqModel.value = 'llama-3.3-70b-versatile';
                    return 'llama-3.3-70b-versatile';
                }
                return groqModel;
            default: return '';
        }
    }

    getCurrentApiKey() {
        // 現在選択されているプロバイダーのAPIキーを取得
        const apiKeys = this.getStoredApiKeys();
        return apiKeys[this.currentAiProvider] || '';
    }

    getStoredApiKeys() {
        // LocalStorageからAPIキーを取得
        try {
            const keys = localStorage.getItem('ai_api_keys');
            return keys ? JSON.parse(keys) : {};
        } catch (error) {
            console.error('APIキーの読み込みエラー:', error);
            return {};
        }
    }

    saveApiKey(provider, apiKey) {
        // LocalStorageにAPIキーを保存
        try {
            const keys = this.getStoredApiKeys();
            keys[provider] = apiKey;
            localStorage.setItem('ai_api_keys', JSON.stringify(keys));
        } catch (error) {
            console.error('APIキーの保存エラー:', error);
        }
    }

    getStoredModels() {
        // LocalStorageからモデル設定を取得
        try {
            const models = localStorage.getItem('ai_models');
            return models ? JSON.parse(models) : {};
        } catch (error) {
            console.error('モデル設定の読み込みエラー:', error);
            return {};
        }
    }

    saveModel(provider, model) {
        // LocalStorageにモデル設定を保存
        try {
            const models = this.getStoredModels();
            models[provider] = model;
            localStorage.setItem('ai_models', JSON.stringify(models));
        } catch (error) {
            console.error('モデル設定の保存エラー:', error);
        }
    }

    saveCharacterSetting(characterText) {
        // LocalStorageにキャラクター設定を保存
        try {
            localStorage.setItem('character_setting', characterText);
        } catch (error) {
            console.error('キャラクター設定の保存エラー:', error);
        }
    }

    getStoredCharacterSetting() {
        // LocalStorageからキャラクター設定を取得
        try {
            return localStorage.getItem('character_setting') || '';
        } catch (error) {
            console.error('キャラクター設定の読み込みエラー:', error);
            return '';
        }
    }

    loadApiKeys() {
        // 保存されたAPIキーを入力フィールドに設定
        const keys = this.getStoredApiKeys();
        
        if (keys.gemini) {
            this.geminiApiKey.value = keys.gemini;
        }
        if (keys.openai) {
            this.openaiApiKey.value = keys.openai;
        }
        if (keys.groq) {
            this.groqApiKey.value = keys.groq;
        }
        if (keys.aivis) {
            this.aivisApiKey.value = keys.aivis;
        }
        
        // 保存されたモデル設定を読み込み
        this.loadModels();
        
        // APIステータスを更新
        this.updateApiStatus('gemini');
        this.updateApiStatus('openai');
        this.updateApiStatus('groq');
        this.updateApiStatus('aivis');
    }

    loadModels() {
        // 保存されたモデル設定を入力フィールドに設定
        const models = this.getStoredModels();
        
        if (models.openai) {
            this.openaiModel.value = models.openai;
        }
        if (models.groq) {
            this.groqModel.value = models.groq;
        }

        // 保存されたキャラクター設定を読み込み
        const characterSetting = this.getStoredCharacterSetting();
        this.characterSetting.value = characterSetting;
    }

    async testApiConnection(provider) {
        console.log(`=== フロントエンド: ${provider} API接続テスト開始 ===`);
        
        const apiKeys = this.getStoredApiKeys();
        const apiKey = apiKeys[provider];
        
        console.log('取得したAPIキー:', apiKey ? `${apiKey.substring(0, 10)}...` : 'なし');
        console.log('認証トークン:', this.authToken ? `${this.authToken.substring(0, 10)}...` : 'なし');
        
        if (!apiKey || !apiKey.trim()) {
            console.log('APIキーが入力されていません');
            this.showError('APIキーが入力されていません');
            return;
        }

        const testBtn = document.getElementById(`test${provider.charAt(0).toUpperCase() + provider.slice(1)}Btn`);
        const statusElement = this[`${provider}Status`];
        
        console.log('テストボタン要素:', testBtn);
        console.log('ステータス要素:', statusElement);
        
        // テスト中の表示
        testBtn.disabled = true;
        testBtn.textContent = 'テスト中...';
        statusElement.textContent = 'APIキーをテスト中...';
        statusElement.className = 'api-status testing';

        const requestData = {
            provider: provider,
            apiKey: apiKey
        };
        
        console.log('送信するリクエストデータ:', requestData);

        try {
            console.log('fetchリクエストを送信中...');
            const response = await fetch('/api/test-api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(requestData)
            });
            
            console.log('レスポンス受信:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                if (result.valid) {
                    statusElement.textContent = `${result.message} ✓`;
                    statusElement.className = 'api-status connected';
                    testBtn.textContent = 'OK';
                    testBtn.style.background = '#28a745';
                } else {
                    statusElement.textContent = result.message;
                    statusElement.className = 'api-status disconnected';
                    testBtn.textContent = 'エラー';
                    testBtn.style.background = '#dc3545';
                }
            } else {
                throw new Error(result.message);
            }

        } catch (error) {
            console.error('=== フロントエンド: APIキーテストエラー ===');
            console.error('エラー詳細:', error);
            console.error('エラータイプ:', error.constructor.name);
            console.error('エラーメッセージ:', error.message);
            console.error('エラースタック:', error.stack);
            
            statusElement.textContent = `テスト失敗: ${error.message}`;
            statusElement.className = 'api-status disconnected';
            testBtn.textContent = 'エラー';
            testBtn.style.background = '#dc3545';
        } finally {
            console.log('=== フロントエンド: APIキーテスト完了 ===');
            testBtn.disabled = false;
            // 3秒後にボタンを元に戻す
            setTimeout(() => {
                testBtn.textContent = '接続テスト';
                testBtn.style.background = '';
            }, 3000);
        }
    }

    updateApiStatus(provider = null) {
        const providerNames = {
            'gemini': 'Gemini',
            'openai': 'OpenAI',
            'groq': 'Groq',
            'aivis': 'AIVIS'
        };
        
        if (provider) {
            // 特定のプロバイダーのステータスを更新
            const apiKeys = this.getStoredApiKeys();
            const statusElement = this[`${provider}Status`];
            
            if (apiKeys[provider] && apiKeys[provider].trim()) {
                statusElement.textContent = `${providerNames[provider]} API 設定済み`;
                statusElement.className = 'api-status connected';
            } else {
                statusElement.textContent = 'APIキーを入力してください';
                statusElement.className = 'api-status disconnected';
            }
        }
        
        // 現在のプロバイダーの全体ステータスを更新
        const currentApiKey = this.getCurrentApiKey();
        if (currentApiKey && currentApiKey.trim()) {
            this.apiStatus.textContent = `${providerNames[this.currentAiProvider]} 使用中`;
            this.apiStatus.className = 'api-status connected';
            this.sendBtn.disabled = false;
        } else {
            this.apiStatus.textContent = `${providerNames[this.currentAiProvider]} APIキーが必要です`;
            this.apiStatus.className = 'api-status disconnected';
            this.sendBtn.disabled = true;
        }
    }

    async sendMessage() {
        const message = this.textInput.value.trim();
        
        if (!message) {
            this.showError('メッセージを入力してください');
            return;
        }

        const currentApiKey = this.getCurrentApiKey();
        if (!currentApiKey) {
            const providerNames = {
                'gemini': 'Gemini',
                'openai': 'OpenAI',
                'groq': 'Groq'
            };
            this.showError(`${providerNames[this.currentAiProvider]} APIキーを設定してください`);
            return;
        }

        // ユーザーメッセージを追加
        this.addMessageToChat('user', message);
        this.textInput.value = '';
        this.updateCharacterCount();

        // AIの返答を取得
        this.setLoadingState(true);
        this.hideError();

        // デバッグ用：送信データを確認
        const characterSetting = this.getStoredCharacterSetting();
        const sendData = {
            message: message,
            provider: this.currentAiProvider,
            model: this.getCurrentModel(),
            maxLength: parseInt(this.maxLength.value) || 100,
            apiKeys: this.getStoredApiKeys(),
            characterSetting: characterSetting
        };
        console.log('クライアント送信データ:', sendData);
        console.log('JSON化後:', JSON.stringify(sendData));

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    message: message,
                    provider: this.currentAiProvider,
                    model: this.getCurrentModel(),
                    maxLength: parseInt(this.maxLength.value) || 100,
                    apiKeys: this.getStoredApiKeys(), // APIキーを送信
                    characterSetting: this.getStoredCharacterSetting() // キャラクター設定を送信
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                throw new Error(data.message);
            }

            // AIメッセージを追加
            this.addMessageToChat('assistant', data.response);
            
            // 自動音声再生（エラーが発生しても処理を続行）
            try {
                await this.playTextToSpeech(data.response);
            } catch (error) {
                console.log('音声再生をスキップ:', error.message);
            }

        } catch (error) {
            console.error('チャットエラー:', error);
            this.showError(`チャットエラー: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${role}-message`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = content;
        
        messageDiv.appendChild(messageContent);
        
        // AIメッセージには再生ボタンを追加
        if (role === 'assistant') {
            const controls = document.createElement('div');
            controls.className = 'message-controls';
            
            const playBtn = document.createElement('button');
            playBtn.className = 'play-message-btn';
            playBtn.textContent = '🔊 再生';
            playBtn.addEventListener('click', () => {
                this.playTextToSpeech(content);
            });
            
            controls.appendChild(playBtn);
            messageDiv.appendChild(controls);
        }
        
        this.chatHistoryEl.appendChild(messageDiv);
        
        // 確実に最新メッセージにスクロール
        setTimeout(() => {
            this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }

    clearChatHistory() {
        // ウェルカムメッセージ以外を削除
        const messages = this.chatHistoryEl.querySelectorAll('.user-message, .assistant-message:not(.welcome-message .assistant-message)');
        messages.forEach(message => message.remove());
    }

    async playTextToSpeech(text) {
        try {
            // モデル選択の検証
            if (!this.modelSelect.value) {
                console.error('モデルが選択されていません');
                this.showError('音声モデルが選択されていません');
                return;
            }

            // キャッシュキーを生成（テキスト + モデルID）
            const cacheKey = `${text}_${this.modelSelect.value}`;
            
            // キャッシュから音声データを確認
            if (this.audioCache.has(cacheKey)) {
                console.log('キャッシュから音声を再生:', text.substring(0, 20) + '...');
                const cachedAudioUrl = this.audioCache.get(cacheKey);
                await this.playAudioFromUrl(cachedAudioUrl);
                return;
            }

            console.log('新規音声生成 (直接AIVIS API):', text.substring(0, 20) + '...');
            console.log('使用モデル:', this.modelSelect.value);
            
            // AIVIS APIに直接アクセス（ストリーミング対応）
            await this.playTextToSpeechDirect(text, this.modelSelect.value);

        } catch (error) {
            console.error('音声再生エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    async playTextToSpeechDirect(text, modelId) {
        // サーバー経由でAIVIS Cloud APIにアクセス
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            },
            body: JSON.stringify({
                text: text,
                modelId: modelId,
                quality: this.audioQuality.value,
                apiKeys: this.getStoredApiKeys() // ユーザーのAPIキーを送信
            })
        });

        if (!response.ok) {
            let errorMessage = `AIVIS API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) {
                    errorMessage += ` - ${errorData.detail}`;
                }
            } catch (e) {
                // JSON解析エラーは無視
            }
            throw new Error(errorMessage);
        }

        // ストリーミング再生の実装
        console.log('ストリーミング音声再生を開始...');
        await this.playStreamingAudio(response, text, modelId);
    }

    getOptimalSamplingRate() {
        // 音声品質設定に基づいて最適なサンプリングレートを選択
        const quality = this.audioQuality.value;
        switch (quality) {
            case 'high': return 48000;   // 高品質: 48kHz
            case 'medium': return 44100; // 標準品質: 44.1kHz
            case 'low': return 24000;    // 低品質（高速）: 24kHz
            default: return 44100;
        }
    }

    getOptimalBitrate() {
        // 音声品質設定に基づいて最適なビットレートを選択
        const quality = this.audioQuality.value;
        switch (quality) {
            case 'high': return 320;     // 高品質: 320kbps
            case 'medium': return 192;   // 標準品質: 192kbps
            case 'low': return 128;      // 低品質（高速）: 128kbps
            default: return 192;
        }
    }

    async playStreamingAudio(response, text, modelId) {
        try {
            // 既存の音声を停止
            this.stopSpeech();
            
            // MediaSource / ManagedMediaSource でストリーミング再生
            // iOS Safari は MediaSource 非対応だが、iOS 17.1 以降では代わりに ManagedMediaSource を利用
            const MediaSourceClass = window.MediaSource || window.ManagedMediaSource;
            
            if (!MediaSourceClass) {
                // ストリーミング非対応の場合はフォールバック
                console.warn('MediaSource未対応: 通常再生にフォールバック');
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                await this.playAudioFromUrl(audioUrl);
                return;
            }

            const mediaSource = new MediaSourceClass();
            this.currentAudio = new Audio(URL.createObjectURL(mediaSource));
            this.currentAudio.disableRemotePlayback = true; // ManagedMediaSource での再生に必要
            this.currentAudio.volume = parseFloat(this.volumeSlider.value) || 1.0;
            
            // デバッグ情報
            console.log('Audio要素作成:', {
                src: this.currentAudio.src,
                canPlayType_mp3: this.currentAudio.canPlayType('audio/mpeg'),
                canPlayType_mp4: this.currentAudio.canPlayType('audio/mp4'),
                canPlayType_wav: this.currentAudio.canPlayType('audio/wav')
            });
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value) || 1.0;
            
            // 音声再生開始イベント
            this.currentAudio.addEventListener('play', () => {
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                this.pauseContinuousMode(); // 常時待機モードを一時停止
                console.log('ストリーミング音声再生開始');
            });

            this.currentAudio.addEventListener('ended', () => {
                this.isPlaying = false;
                this.stopBtn.disabled = true;
                this.resumeContinuousMode(); // 常時待機モードを再開
                console.log('ストリーミング音声再生終了');
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('ストリーミング音声再生エラー:', e);
                console.log('エラーコード:', this.currentAudio.error?.code);
                console.log('エラーメッセージ:', this.currentAudio.error?.message);
                
                // フォールバック: 元のテキストで通常のTTS再生を試行
                console.log('通常音声生成にフォールバック中...');
                this.showVoiceServiceSwitch('AIVIS（ストリーミング）', 'AIVIS（通常）');
                this.fallbackToNormalTTS(text);
                
                this.isPlaying = false;
                this.stopBtn.disabled = true;
                this.resumeContinuousMode();
            });

            // 音声再生を開始（データがまだ不完全でも開始）
            this.currentAudio.play().catch(console.error);

            mediaSource.addEventListener('sourceopen', async () => {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
                
                // updating フラグが立っていたら updateend まで待つ
                const waitForIdle = () => 
                    sourceBuffer.updating ? 
                    new Promise(resolve => sourceBuffer.addEventListener('updateend', resolve, {once: true})) : 
                    Promise.resolve();

                const reader = response.body.getReader();
                
                try {
                    for (;;) {
                        const { value, done } = await reader.read();
                        
                        if (done) {
                            await waitForIdle(); // 最後の書き込みを待つ
                            console.log('ストリーミングデータ受信完了');
                            mediaSource.endOfStream();
                            
                            // ストリーミング完了後はキャッシュ処理をスキップ
                            // （ストリーミングは一度きりの再生のため）
                            break;
                        }
                        
                        await waitForIdle();
                        sourceBuffer.appendBuffer(value);
                        await waitForIdle();
                    }
                } catch (error) {
                    console.error('ストリーミングデータ処理エラー:', error);
                    if (mediaSource.readyState === 'open') {
                        mediaSource.endOfStream('network');
                    }
                }
            });

        } catch (error) {
            console.error('ストリーミング再生エラー:', error);
            // フォールバック: 通常の再生方式
            try {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                await this.playAudioFromUrl(audioUrl);
            } catch (fallbackError) {
                console.error('フォールバック再生も失敗:', fallbackError);
                this.showError('音声再生に失敗しました');
            }
        }
    }

    async playAudioFromUrl(audioUrl) {
        try {
            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    updateSliderValues() {
        this.speedValue.textContent = this.speedSlider.value;
        this.volumeValue.textContent = this.volumeSlider.value;
    }

    saveSettings() {
        const settings = {
            speed: this.speedSlider.value,
            volume: this.volumeSlider.value,
            selectedModel: this.modelSelect.value,
            maxLength: this.maxLength.value,
            audioQuality: this.audioQuality.value,
            customModels: this.getCustomModels() // カスタムモデルも保存
        };
        
        localStorage.setItem('tts_app_settings', JSON.stringify(settings));
        console.log('設定を保存しました:', settings);
    }

    getCustomModels() {
        // カスタムモデル（手動追加されたもの）を取得
        const customModels = [];
        Array.from(this.modelSelect.options).forEach(option => {
            if (option.textContent.includes('カスタムモデル')) {
                customModels.push({
                    uuid: option.value,
                    name: option.textContent
                });
            }
        });
        return customModels;
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('tts_app_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log('設定を読み込みました:', settings);
                
                // 音声設定を復元
                if (settings.speed) {
                    this.speedSlider.value = settings.speed;
                    this.speedValue.textContent = settings.speed;
                }
                
                if (settings.volume) {
                    this.volumeSlider.value = settings.volume;
                    this.volumeValue.textContent = settings.volume;
                }
                
                // AI設定を復元
                if (settings.maxLength) {
                    this.maxLength.value = settings.maxLength;
                }
                
                if (settings.audioQuality) {
                    this.audioQuality.value = settings.audioQuality;
                }
                
                // モデル選択とカスタムモデルは後で復元（モデル一覧読み込み後）
                this.savedModelId = settings.selectedModel;
                this.savedCustomModels = settings.customModels || [];
            }
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    restoreModelSelection() {
        // カスタムモデルを復元
        if (this.savedCustomModels && this.savedCustomModels.length > 0) {
            this.savedCustomModels.forEach(customModel => {
                // 既に存在しないかチェック
                const exists = Array.from(this.modelSelect.options).some(opt => opt.value === customModel.uuid);
                if (!exists) {
                    const option = document.createElement('option');
                    option.value = customModel.uuid;
                    option.textContent = customModel.name;
                    this.modelSelect.appendChild(option);
                    console.log('カスタムモデルを復元:', customModel.name);
                }
            });
            this.savedCustomModels = null; // 使用後はクリア
        }

        // モデル選択を復元
        if (this.savedModelId) {
            const option = Array.from(this.modelSelect.options).find(opt => opt.value === this.savedModelId);
            if (option) {
                this.modelSelect.value = this.savedModelId;
                this.updateModelInfo();
                console.log('モデル選択を復元しました:', this.savedModelId);
            } else {
                console.warn('保存されたモデルが見つかりません:', this.savedModelId);
            }
            this.savedModelId = null; // 使用後はクリア
        }
    }

    async loadAvailableModels() {
        try {
            this.modelSelect.innerHTML = '<option value="">モデルを読み込み中...</option>';

            // サーバー経由でモデル一覧を取得
            const response = await fetch('/api/models', {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            if (response.ok) {
                const models = await response.json();
                this.availableModels = models;
                this.populateModelSelect();
            } else {
                // フォールバック: デフォルトモデルを使用
                this.useDefaultModels();
            }
        } catch (error) {
            console.error('モデル一覧の取得に失敗:', error);
            this.useDefaultModels();
        } finally {
            // モデル一覧読み込み完了後に保存されたモデルを復元
            this.restoreModelSelection();
        }
    }

    useDefaultModels() {
        // デフォルトモデル（動作確認済みのモデルのみ）
        this.availableModels = [
            {
                uuid: 'a59cb814-0083-4369-8542-f51a29e72af7',
                name: 'デフォルトモデル',
                description: '標準的な音声モデル（動作確認済み）',
                voice_type: 'female',
                styles: ['normal']
            }
        ];
        this.populateModelSelect();
    }

    populateModelSelect() {
        this.modelSelect.innerHTML = '';
        
        // モデルを声のタイプ別にグループ化
        const groupedModels = {};
        this.availableModels.forEach(model => {
            const group = this.getVoiceTypeLabel(model.voice_type);
            if (!groupedModels[group]) {
                groupedModels[group] = [];
            }
            groupedModels[group].push(model);
        });

        // グループごとにオプションを追加
        Object.keys(groupedModels).forEach(groupName => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            
            groupedModels[groupName].forEach(model => {
                const option = document.createElement('option');
                option.value = model.uuid;
                option.textContent = model.name;
                option.dataset.modelData = JSON.stringify(model);
                optgroup.appendChild(option);
            });
            
            this.modelSelect.appendChild(optgroup);
        });

        // 最初のモデルを選択（復元は後で行う）
        if (this.availableModels.length > 0) {
            this.modelSelect.value = this.availableModels[0].uuid;
            this.updateModelInfo();
        } else {
            // フォールバック: デフォルトモデルを設定
            this.modelSelect.innerHTML = '<option value="a59cb814-0083-4369-8542-f51a29e72af7">デフォルトモデル</option>';
            this.modelSelect.value = 'a59cb814-0083-4369-8542-f51a29e72af7';
        }
    }

    getVoiceTypeLabel(voiceType) {
        const labels = {
            'female': '女性の声',
            'male': '男性の声',
            'young_female': '若い女性の声',
            'young_male': '若い男性の声',
            'adult_female': '大人の女性の声',
            'adult_male': '大人の男性の声',
            'elderly_female': '年配の女性の声',
            'elderly_male': '年配の男性の声'
        };
        return labels[voiceType] || 'その他';
    }

    updateModelInfo() {
        const selectedOption = this.modelSelect.selectedOptions[0];
        if (selectedOption && selectedOption.dataset.modelData) {
            const model = JSON.parse(selectedOption.dataset.modelData);
            const stylesText = model.styles ? model.styles.join(', ') : 'normal';
            
            this.modelInfo.innerHTML = `
                <div class="model-details">
                    <strong>${model.name}</strong><br>
                    ${model.description}<br>
                    <small>声の種類: ${this.getVoiceTypeLabel(model.voice_type)} | スタイル: ${stylesText}</small>
                </div>
            `;
        } else {
            this.modelInfo.innerHTML = '<span class="model-description">モデルを選択すると詳細が表示されます</span>';
        }
    }

    addCustomModel() {
        const customId = this.customModelId.value.trim();
        
        if (!customId) {
            this.showError('有効なモデルUUIDを入力してください');
            return;
        }

        // UUID形式の簡単なチェック（8-4-4-4-12文字のパターン）
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidPattern.test(customId)) {
            this.showError('正しいUUID形式で入力してください（例: a59cb814-0083-4369-8542-f51a29e72af7）');
            return;
        }
        
        // 既存の選択肢をチェック
        const existingOptions = Array.from(this.modelSelect.options);
        const exists = existingOptions.some(option => option.value === customId);
        
        if (exists) {
            this.showError('このモデルUUIDは既に追加されています');
            return;
        }

        // 新しい選択肢を追加
        const option = document.createElement('option');
        option.value = customId;
        option.textContent = `カスタムモデル (${customId.substring(0, 8)}...)`;
        this.modelSelect.appendChild(option);
        
        // 追加したモデルを選択
        this.modelSelect.value = customId;
        this.updateModelInfo();
        
        // 入力フィールドをクリア
        this.customModelId.value = '';
        
        // 設定を保存
        this.saveSettings();
        
        this.hideError();
    }

    async generateAndPlaySpeech() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            this.showError('読み上げるテキストを入力してください');
            return;
        }

        if (text.length > 200) {
            this.showError('テキストは200文字以内で入力してください');
            return;
        }

        this.setLoadingState(true);
        this.hideError();

        try {
            const requestData = {
                text: text,
                modelId: this.modelSelect.value,
                quality: this.audioQuality.value
            };

            console.log('AIVIS Cloud APIにリクエスト送信:', requestData);

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            // レスポンスのContent-Typeをチェック
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('audio/')) {
                // 音声データの場合、直接再生
                console.log('音声データを受信:', contentType);
                const audioBlob = await response.blob();
                await this.playAudioFromBlob(audioBlob);
            } else {
                // JSONレスポンスの場合
                const data = await response.json();
                console.log('APIレスポンス:', data);

                if (data.status === 'error') {
                    throw new Error(data.message || 'APIエラーが発生しました');
                }

                if (data.audioData) {
                    // Base64音声データの場合
                    await this.playAudioFromBase64(data.audioData);
                } else if (data.data) {
                    // その他のデータ形式の場合
                    console.log('データを受信しましたが、音声形式が不明です');
                    this.showError('音声データの形式が不明です');
                } else {
                    throw new Error('音声データを取得できませんでした');
                }
            }

        } catch (error) {
            console.error('音声生成エラー:', error);
            this.showError(`音声生成に失敗しました: ${error.message}`);
        } finally {
            this.setLoadingState(false);
        }
    }

    async playAudioFromBlob(audioBlob) {
        try {
            // BlobからURLを作成
            const audioUrl = URL.createObjectURL(audioBlob);

            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
                
                // 常時待機モードが有効な場合は再開を試行
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.resumeContinuousMode();
                    }, 1500);
                }
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    async playAudioFromBase64(base64Data) {
        try {
            // Base64データからバイナリデータに変換
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Blobオブジェクトを作成
            const audioBlob = new Blob([bytes], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // 既存の音声を停止
            this.stopSpeech();

            // 新しい音声を作成・再生（プリロード有効）
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.preload = 'auto'; // プリロード有効化
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            this.currentAudio.playbackRate = parseFloat(this.speedSlider.value);
            
            // 音声再生イベントリスナー
            this.currentAudio.addEventListener('loadstart', () => {
                console.log('音声読み込み開始');
            });

            this.currentAudio.addEventListener('canplaythrough', () => {
                console.log('音声再生可能');
            });

            this.currentAudio.addEventListener('play', () => {
                console.log('音声再生開始');
                this.isPlaying = true;
                this.stopBtn.disabled = false;
                
                // 音声再生中は常時待機モードを一時停止
                if (this.isContinuousMode) {
                    this.pauseContinuousMode();
                }
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
                
                // 常時待機モードが有効な場合は再開を試行
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.resumeContinuousMode();
                    }, 1500);
                }
            });

            this.currentAudio.addEventListener('error', (e) => {
                console.error('音声再生エラー:', e);
                this.showError('音声の再生に失敗しました');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
            });

            // 音声再生開始
            await this.currentAudio.play();

        } catch (error) {
            console.error('音声再生処理エラー:', error);
            this.showError(`音声再生に失敗しました: ${error.message}`);
            this.resetPlaybackState();
        }
    }

    stopSpeech() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
        }
        
        // Web Speech APIの音声も停止
        if (this.currentUtterance) {
            speechSynthesis.cancel();
            this.currentUtterance = null;
        }
        
        this.resetPlaybackState();
    }

    async fallbackToNormalTTS(text) {
        try {
            console.log('フォールバック: 通常のTTS再生を試行');
            
            // ストリーミング以外の方法で音声生成を試行
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: JSON.stringify({
                    text: text,
                    modelId: this.modelSelect.value,
                    quality: 'medium', // フォールバック時は標準品質
                    apiKeys: this.getStoredApiKeys() // APIキーを送信
                })
            });

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status}`);
            }

            // 通常のblob再生を試行
            const audioBlob = await response.blob();
            console.log('フォールバックBlob作成成功:', {
                size: audioBlob.size,
                type: audioBlob.type
            });
            
            // 音声データの先頭を16進数で確認（デバッグ用）
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            const hexString = Array.from(uint8Array.slice(0, 20))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ');
            console.log('音声データ先頭20バイト(hex):', hexString);
            console.log('音声データ先頭20バイト(text):', new TextDecoder('utf-8', {fatal: false}).decode(uint8Array.slice(0, 20)));
            
            if (audioBlob.size <= 50) { // 44バイトなど極小サイズの場合
                console.log('音声データが小さすぎるため、Web Speech APIにフォールバック');
                throw new Error('音声データが不完全');
            }
            
            const audioUrl = URL.createObjectURL(audioBlob);
            await this.playAudioFromUrl(audioUrl);
            
        } catch (error) {
            console.error('フォールバックTTS再生エラー:', error);
            console.log('Web Speech APIにフォールバック');
            this.showVoiceServiceSwitch('AIVIS', 'ブラウザ標準音声');
            this.playWithWebSpeechAPI(text);
        }
    }

    playWithWebSpeechAPI(text) {
        try {
            if ('speechSynthesis' in window) {
                console.log('Web Speech APIで音声合成中:', text.substring(0, 30) + '...');
                
                // 既存の発話を停止
                speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                
                // 日本語の声を探す
                const voices = speechSynthesis.getVoices();
                const japaneseVoice = voices.find(voice => 
                    voice.lang.includes('ja') || voice.name.includes('Japanese')
                );
                
                if (japaneseVoice) {
                    utterance.voice = japaneseVoice;
                    console.log('日本語音声を使用:', japaneseVoice.name);
                } else {
                    console.log('日本語音声が見つからないため、デフォルト音声を使用');
                }
                
                utterance.rate = parseFloat(this.speedSlider.value) || 1.0;
                utterance.volume = parseFloat(this.volumeSlider.value) || 1.0;
                
                utterance.onstart = () => {
                    console.log('Web Speech API音声開始');
                    this.isPlaying = true;
                    this.stopBtn.disabled = false;
                };
                
                utterance.onend = () => {
                    console.log('Web Speech API音声終了');
                    this.resetPlaybackState();
                };
                
                utterance.onerror = (event) => {
                    console.error('Web Speech APIエラー:', event.error);
                    this.resetPlaybackState();
                };
                
                speechSynthesis.speak(utterance);
                this.currentUtterance = utterance; // 停止用に保存
                
            } else {
                console.log('Web Speech APIがサポートされていません');
            }
        } catch (error) {
            console.error('Web Speech API使用エラー:', error);
        }
    }

    showVoiceServiceSwitch(fromService, toService) {
        // 音声サービス切り替えの通知を表示
        const notification = document.createElement('div');
        notification.className = 'voice-service-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">🔄</span>
                <span class="notification-text">
                    ${fromService}音声サービスが利用できないため、<strong>${toService}</strong>に切り替えました
                </span>
            </div>
        `;
        
        // 既存の通知があれば削除
        const existingNotification = document.querySelector('.voice-service-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // 通知を表示
        document.body.appendChild(notification);
        
        // 5秒後に自動削除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        console.log(`音声サービス切り替え: ${fromService} → ${toService}`);
    }

    resetPlaybackState() {
        this.isPlaying = false;
        this.stopBtn.disabled = true;
        
        // 音声再生終了時に常時待機モードを再開
        if (this.isContinuousMode) {
            console.log('音声再生終了 - 常時待機モードを再開します');
            setTimeout(() => {
                this.resumeContinuousMode();
            }, 2000); // 少し長めの待機時間
        }
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.loadingIndicator.classList.remove('hidden');
            this.sendBtn.disabled = true;
        } else {
            this.loadingIndicator.classList.add('hidden');
            // APIキーがあるかチェックして送信ボタンを有効化
            const currentApiKey = this.getCurrentApiKey();
            this.sendBtn.disabled = !currentApiKey || !currentApiKey.trim();
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        
        // 5秒後に自動で非表示
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    showStatus(message) {
        // 簡単な実装：エラーメッセージ領域を一時的に使用
        this.errorMessage.textContent = message;
        this.errorMessage.style.background = '#d4edda';
        this.errorMessage.style.color = '#155724';
        this.errorMessage.style.border = '1px solid #c3e6cb';
        this.errorMessage.classList.remove('hidden');
        
        // 3秒後に自動で非表示
        setTimeout(() => {
            this.hideError();
            // 元の色に戻す
            this.errorMessage.style.background = '';
            this.errorMessage.style.color = '';
            this.errorMessage.style.border = '';
        }, 3000);
    }

    hideError() {
        this.errorMessage.classList.add('hidden');
    }

    // 音声認識の初期化
    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            
            // 通常の音声認識
            this.recognition = new SpeechRecognition();
            this.recognition.lang = 'ja-JP';
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            
            // 常時待機モード用の音声認識
            this.continuousRecognition = new SpeechRecognition();
            this.continuousRecognition.lang = 'ja-JP';
            this.continuousRecognition.continuous = true;
            this.continuousRecognition.interimResults = true;
            this.continuousRecognition.maxAlternatives = 1;
            
            // 音声認識イベントの設定
            this.recognition.onstart = () => {
                console.log('音声認識を開始しました');
                this.isListening = true;
                this.updateVoiceStatus('listening', '聞いています...');
                this.voiceInputBtn.classList.add('recording');
                this.voiceInputBtn.disabled = false;
            };
            
            this.recognition.onresult = (event) => {
                let transcript = '';
                let isFinal = false;
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        transcript += event.results[i][0].transcript;
                        isFinal = true;
                    } else {
                        transcript += event.results[i][0].transcript;
                    }
                }
                
                if (isFinal) {
                    console.log('音声認識結果:', transcript);
                    this.textInput.value = transcript;
                    this.updateCharacterCount();
                    this.updateVoiceStatus('processing', '音声を認識しました');
                } else {
                    // 暫定結果の表示
                    this.updateVoiceStatus('listening', `認識中: ${transcript}`);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('音声認識エラー:', event.error);
                this.isListening = false;
                this.voiceInputBtn.classList.remove('recording');
                this.voiceInputBtn.disabled = false;
                
                let errorMessage = '音声認識でエラーが発生しました';
                switch (event.error) {
                    case 'no-speech':
                        errorMessage = '音声が検出されませんでした';
                        break;
                    case 'audio-capture':
                        errorMessage = 'マイクにアクセスできませんでした';
                        break;
                    case 'not-allowed':
                        errorMessage = 'マイクの使用が許可されていません';
                        break;
                    case 'network':
                        errorMessage = 'ネットワークエラーが発生しました';
                        break;
                }
                
                this.updateVoiceStatus('error', errorMessage);
            };
            
            this.recognition.onend = () => {
                console.log('音声認識を終了しました');
                this.isListening = false;
                this.voiceInputBtn.classList.remove('recording');
                this.voiceInputBtn.disabled = false;
                
                if (!this.voiceStatus.classList.contains('error')) {
                    this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
                }
            };
            
            console.log('音声認識が利用可能です');
            this.setupContinuousRecognition();
            this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
        } else {
            console.warn('音声認識がサポートされていません');
            this.voiceInputBtn.disabled = true;
            this.continuousVoiceBtn.disabled = true;
            this.updateVoiceStatus('error', '音声認識がサポートされていません');
        }
    }

    // 音声入力の開始/停止切り替え
    toggleVoiceInput() {
        if (!this.recognition) {
            this.updateVoiceStatus('error', '音声認識が利用できません');
            return;
        }
        
        if (this.isListening) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }

    // 音声入力開始
    startVoiceInput() {
        try {
            this.voiceInputBtn.disabled = true;
            this.updateVoiceStatus('processing', '音声認識を開始しています...');
            this.recognition.start();
        } catch (error) {
            console.error('音声認識の開始に失敗:', error);
            this.updateVoiceStatus('error', '音声認識の開始に失敗しました');
            this.voiceInputBtn.disabled = false;
        }
    }

    // 音声入力停止
    stopVoiceInput() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // 音声入力状態の更新
    updateVoiceStatus(type, message) {
        this.voiceStatus.className = `voice-status ${type}`;
        this.voiceStatus.innerHTML = message;
        
        // エラーの場合は5秒後に元に戻す
        if (type === 'error') {
            setTimeout(() => {
                this.voiceStatus.className = 'voice-status';
                this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: マイクボタンを押して話してください</span>';
            }, 5000);
        }
    }

    // 常時待機モード用音声認識の設定
    setupContinuousRecognition() {
        this.continuousRecognition.onstart = () => {
            console.log('常時待機モード開始');
            this.isContinuousMode = true;
            this.updateVoiceStatus('listening', '常時待機中 - 話しかけてください');
        };

        this.continuousRecognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    transcript += event.results[i][0].transcript;
                    isFinal = true;
                }
            }
            
            if (isFinal && transcript.trim()) {
                console.log('常時待機モード - 音声認識結果:', transcript);
                this.textInput.value = transcript;
                this.updateCharacterCount();
                this.updateVoiceStatus('processing', '音声を認識しました - 自動送信中...');
                
                // 1秒後に自動送信
                setTimeout(() => {
                    this.sendMessage();
                }, 1000);
            }
        };

        this.continuousRecognition.onerror = (event) => {
            console.error('常時待機モード - 音声認識エラー:', event.error);
            
            if (event.error === 'no-speech') {
                // 無音エラーの場合は再開
                if (this.isContinuousMode) {
                    setTimeout(() => {
                        this.restartContinuousRecognition();
                    }, 1000);
                }
            } else {
                this.stopContinuousMode();
                let errorMessage = '常時待機モードでエラーが発生しました';
                switch (event.error) {
                    case 'audio-capture':
                        errorMessage = 'マイクにアクセスできませんでした';
                        break;
                    case 'not-allowed':
                        errorMessage = 'マイクの使用が許可されていません';
                        break;
                    case 'network':
                        errorMessage = 'ネットワークエラーが発生しました';
                        break;
                }
                this.updateVoiceStatus('error', errorMessage);
            }
        };

        this.continuousRecognition.onend = () => {
            console.log('常時待機モード - 音声認識終了');
            if (this.isContinuousMode && !this.isPlaying) {
                // 音声再生中でなければ自動的に再開
                setTimeout(() => {
                    this.restartContinuousRecognition();
                }, 1000);
            }
        };
    }

    // 常時待機モードの開始/停止切り替え
    toggleContinuousMode() {
        if (!this.continuousRecognition) {
            this.updateVoiceStatus('error', '音声認識が利用できません');
            return;
        }

        if (this.isContinuousMode) {
            this.stopContinuousMode();
        } else {
            this.startContinuousMode();
        }
    }

    // 常時待機モード開始
    startContinuousMode() {
        try {
            // 通常の音声入力を停止
            if (this.isListening) {
                this.stopVoiceInput();
            }
            
            this.continuousVoiceBtn.style.display = 'none';
            this.stopContinuousBtn.style.display = 'flex';
            this.voiceInputBtn.disabled = true;
            this.updateVoiceStatus('processing', '常時待機モードを開始しています...');
            this.continuousRecognition.start();
        } catch (error) {
            console.error('常時待機モードの開始に失敗:', error);
            this.updateVoiceStatus('error', '常時待機モードの開始に失敗しました');
            this.continuousVoiceBtn.style.display = 'flex';
            this.stopContinuousBtn.style.display = 'none';
            this.voiceInputBtn.disabled = false;
        }
    }

    // 常時待機モード停止
    stopContinuousMode() {
        this.isContinuousMode = false;
        if (this.continuousRecognition) {
            try {
                this.continuousRecognition.stop();
            } catch (error) {
                console.error('常時待機モード停止エラー:', error);
            }
        }
        this.continuousVoiceBtn.classList.remove('active');
        this.continuousVoiceBtn.style.display = 'flex';
        this.stopContinuousBtn.style.display = 'none';
        this.voiceInputBtn.disabled = false;
        this.updateVoiceStatus('', '音声入力: マイクボタンを押して話してください');
    }

    // 常時待機モードの再開
    restartContinuousRecognition() {
        if (this.isContinuousMode && !this.isPlaying) {
            console.log('常時待機モード再開を試行中...');
            try {
                // 既存の認識が動作中でないことを確認
                if (this.continuousRecognition) {
                    this.continuousRecognition.start();
                    console.log('常時待機モード再開成功');
                }
            } catch (error) {
                console.error('常時待機モード再開エラー:', error);
                // 少し待ってから再試行
                if (error.name === 'InvalidStateError') {
                    setTimeout(() => {
                        if (this.isContinuousMode) {
                            this.restartContinuousRecognition();
                        }
                    }, 2000);
                } else {
                    // その他のエラーの場合は停止
                    this.stopContinuousMode();
                }
            }
        }
    }

    // 常時待機モードの一時停止
    pauseContinuousMode() {
        if (this.isContinuousMode && this.continuousRecognition) {
            try {
                this.continuousRecognition.stop();
                this.updateVoiceStatus('processing', '音声再生中 - 待機モード一時停止');
            } catch (error) {
                console.error('常時待機モード一時停止エラー:', error);
            }
        }
    }

    // 常時待機モードの再開
    resumeContinuousMode() {
        if (this.isContinuousMode && !this.isPlaying) {
            console.log('常時待機モード再開 - 音声再生終了後');
            try {
                this.continuousRecognition.start();
                this.updateVoiceStatus('listening', '常時待機中 - 話しかけてください');
                console.log('常時待機モード再開成功 - 音声再生終了後');
            } catch (error) {
                console.error('常時待機モード再開エラー:', error);
                // InvalidStateErrorの場合は少し待ってから再試行
                if (error.name === 'InvalidStateError') {
                    setTimeout(() => {
                        if (this.isContinuousMode && !this.isPlaying) {
                            this.resumeContinuousMode();
                        }
                    }, 1500);
                } else {
                    // その他のエラーの場合は停止
                    this.stopContinuousMode();
                }
            }
        }
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('テキスト読み上げアプリを初期化中...');
    new TextToSpeechApp();
    console.log('アプリケーション初期化完了');
});