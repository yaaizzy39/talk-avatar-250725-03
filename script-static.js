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
        
        this.initializeApp();
    }

    async initializeApp() {
        // Service Worker を登録
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
            } catch (error) {
            }
        }

        // ログイン画面をスキップして直接メインアプリを表示
        const loginScreen = document.getElementById('loginScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        
        this.initializeMainApp();
    }

    initializeMainApp() {
        // 基本要素の初期化
        this.textInput = document.getElementById('textInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.charCount = document.getElementById('charCount');
        this.chatHistory = document.getElementById('chatHistory');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');

        // キャラクター設定
        this.characterSetting = document.getElementById('characterSetting');

        // 音声関連要素
        this.modelSelect = document.getElementById('modelSelect');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.addModelBtn = document.getElementById('addModelBtn');
        this.customModelId = document.getElementById('customModelId');

        // AI設定要素
        this.aiProvider = document.getElementById('aiProvider');
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

        this.setupEventListeners();
        this.initializeAudioContext();
        this.loadSettings();
        this.loadModels();
        this.loadApiKeys();
        this.updateCharacterCount();
        this.setupVoiceInput();
        this.loadCharacterSetting();
        this.updateApiStatus();
    }


    setupEventListeners() {
        // 基本イベントリスナー
        this.textInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        this.sendBtn.addEventListener('click', () => {
            this.handleSendMessage();
        });

        this.stopBtn.addEventListener('click', () => {
            this.stopPlayback();
        });

        // 音声制御
        this.speedSlider.addEventListener('input', (e) => {
            this.speedValue.textContent = e.target.value;
            this.saveSettings();
        });

        this.volumeSlider.addEventListener('input', (e) => {
            this.volumeValue.textContent = e.target.value;
            this.saveSettings();
        });

        // AI設定
        this.aiProvider.addEventListener('change', () => {
            this.handleProviderChange();
        });

        this.maxLength.addEventListener('input', () => {
            this.saveSettings();
        });

        this.audioQuality.addEventListener('input', () => {
            this.saveSettings();
        });

        // キャラクター設定
        this.characterSetting.addEventListener('input', () => {
            this.saveCharacterSetting();
        });

        // キャラクタープリセット
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset || '';
                this.characterSetting.value = preset;
                this.saveCharacterSetting();
            });
        });

        // サイトボタン
        this.aivisModelSiteBtn = document.getElementById('aivisModelSiteBtn');
        this.aivisModelSiteBtn.addEventListener('click', () => {
            window.open('https://hub.aivis-project.com/search?_gl=1*1v1mldo*_ga*MjA0MjI5OTQ4My4xNzUzNTAzMjk4*_ga_TEMWCS6D7B*czE3NTM1MDMyOTgkbzEkZzEkdDE3NTM1MDMzODQkajYwJGwwJGgw', '_blank');
        });

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
                this.handleSendMessage();
            }
        });

        // 履歴クリアボタン
        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearChatHistory();
        });
    }

    // 音声入力関連
    setupVoiceInput() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: このブラウザではサポートされていません</span>';
            this.voiceInputBtn.disabled = true;
            this.continuousVoiceBtn.disabled = true;
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'ja-JP';

        this.recognition.onstart = () => {
            this.voiceInputBtn.classList.add('recording');
            this.voiceStatus.className = 'voice-status listening';
            this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: 聞き取り中...</span>';
        };

        this.recognition.onresult = (event) => {
            const result = event.results[0][0].transcript;
            this.textInput.value += (this.textInput.value ? ' ' : '') + result;
            this.updateCharacterCount();
        };

        this.recognition.onerror = (event) => {
            this.voiceStatus.className = 'voice-status error';
            this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: エラーが発生しました</span>';
        };

        this.recognition.onend = () => {
            this.voiceInputBtn.classList.remove('recording');
            this.voiceStatus.className = 'voice-status';
            this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: マイクボタンを押して話してください</span>';
        };

        this.voiceInputBtn.addEventListener('click', () => {
            if (this.voiceInputBtn.classList.contains('recording')) {
                this.recognition.stop();
            } else {
                this.recognition.start();
            }
        });

        // 常時待機モード
        this.setupContinuousVoice();
    }

    setupContinuousVoice() {
        let continuousRecognition = null;
        const stopBtn = document.getElementById('stopContinuousBtn');

        this.continuousVoiceBtn.addEventListener('click', () => {
            if (this.continuousVoiceBtn.classList.contains('active')) {
                // 停止
                if (continuousRecognition) {
                    continuousRecognition.stop();
                }
                this.continuousVoiceBtn.classList.remove('active');
                this.continuousVoiceBtn.style.display = 'flex';
                stopBtn.style.display = 'none';
                this.voiceStatus.className = 'voice-status';
                this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: マイクボタンを押して話してください</span>';
            } else {
                // 開始
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                continuousRecognition = new SpeechRecognition();
                continuousRecognition.continuous = true;
                continuousRecognition.interimResults = false;
                continuousRecognition.lang = 'ja-JP';

                continuousRecognition.onstart = () => {
                    this.continuousVoiceBtn.classList.add('active');
                    this.continuousVoiceBtn.style.display = 'none';
                    stopBtn.style.display = 'flex';
                    this.voiceStatus.className = 'voice-status listening';
                    this.voiceStatus.innerHTML = '<span class="voice-info">常時待機中: 何でも話しかけてください</span>';
                };

                continuousRecognition.onresult = (event) => {
                    const lastResult = event.results[event.results.length - 1];
                    if (lastResult.isFinal) {
                        const result = lastResult[0].transcript.trim();
                        if (result) {
                            this.textInput.value = result;
                            this.updateCharacterCount();
                            this.handleSendMessage();
                        }
                    }
                };

                continuousRecognition.onerror = (event) => {
                    this.voiceStatus.className = 'voice-status error';
                    this.voiceStatus.innerHTML = '<span class="voice-info">常時待機: エラーが発生しました</span>';
                };

                continuousRecognition.onend = () => {
                    this.continuousVoiceBtn.classList.remove('active');
                    this.continuousVoiceBtn.style.display = 'flex';
                    stopBtn.style.display = 'none';
                    this.voiceStatus.className = 'voice-status';
                    this.voiceStatus.innerHTML = '<span class="voice-info">音声入力: マイクボタンを押して話してください</span>';
                };

                continuousRecognition.start();
            }
        });

        stopBtn.addEventListener('click', () => {
            if (continuousRecognition) {
                continuousRecognition.stop();
            }
        });
    }

    // APIキー管理
    getCurrentApiKey() {
        const apiKeys = this.getStoredApiKeys();
        return apiKeys[this.currentAiProvider] || '';
    }

    getStoredApiKeys() {
        // LocalStorageからAPIキーを取得
        try {
            const keys = localStorage.getItem('ai_api_keys');
            return keys ? JSON.parse(keys) : {};
        } catch (error) {
            return {};
        }
    }

    saveApiKey(provider, apiKey) {
        try {
            const keys = this.getStoredApiKeys();
            keys[provider] = apiKey;
            localStorage.setItem('ai_api_keys', JSON.stringify(keys));
        } catch (error) {
        }
    }

    loadApiKeys() {
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

    // AIプロバイダー切り替え
    handleProviderChange() {
        const provider = this.aiProvider.value;
        this.currentAiProvider = provider;
        localStorage.setItem('ai_provider', provider);
        
        // 全てのパネルを非表示
        document.querySelectorAll('.ai-config-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // 選択されたプロバイダーのパネルを表示
        const selectedPanel = document.getElementById(`${provider}Config`);
        if (selectedPanel) {
            selectedPanel.style.display = 'block';
        }
        
        this.updateApiStatus();
        this.saveSettings();
    }

    // API接続テスト（簡略化版）
    async testApiConnection(provider) {
        const statusElement = document.getElementById(`${provider}Status`);
        const apiKeys = this.getStoredApiKeys();
        const apiKey = apiKeys[provider];
        
        if (!apiKey || !apiKey.trim()) {
            statusElement.textContent = 'APIキーを入力してください';
            statusElement.className = 'api-status disconnected';
            return;
        }
        
        statusElement.textContent = 'テスト中...';
        statusElement.className = 'api-status testing';
        
        try {
            let testResult = false;
            
            switch (provider) {
                case 'gemini':
                    testResult = await this.testGeminiApiKey(apiKey);
                    break;
                case 'openai':
                    testResult = await this.testOpenAIApiKey(apiKey);
                    break;
                case 'groq':
                    testResult = await this.testGroqApiKey(apiKey);
                    break;
                case 'aivis':
                    testResult = await this.testAivisApiKey(apiKey);
                    break;
            }
            
            if (testResult) {
                statusElement.textContent = '接続成功';
                statusElement.className = 'api-status connected';
            } else {
                statusElement.textContent = '接続失敗';
                statusElement.className = 'api-status disconnected';
            }
        } catch (error) {
            statusElement.textContent = '接続エラー';
            statusElement.className = 'api-status disconnected';
        }
    }

    // 各API接続テスト関数
    async testGeminiApiKey(apiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
                method: 'GET'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async testOpenAIApiKey(apiKey) {
        try {
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async testGroqApiKey(apiKey) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async testAivisApiKey(apiKey) {
        try {
            const response = await fetch('https://api.aivis-project.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    // AIチャット処理（直接API呼び出し）
    async sendMessageToAI(message, provider, model, maxLength, characterSetting) {
        const apiKeys = this.getStoredApiKeys();
        const apiKey = apiKeys[provider];
        
        if (!apiKey) {
            throw new Error(`${provider}のAPIキーが設定されていません`);
        }

        switch (provider) {
            case 'gemini':
                return await this.handleGeminiRequest(message, apiKey, model, maxLength, characterSetting);
            case 'openai':
                return await this.handleOpenAIRequest(message, apiKey, model, maxLength, characterSetting);
            case 'groq':
                return await this.handleGroqRequest(message, apiKey, model, maxLength, characterSetting);
            default:
                throw new Error(`未対応のプロバイダー: ${provider}`);
        }
    }

    async handleGeminiRequest(message, apiKey, model, maxLength, characterSetting) {
        const systemPrompt = characterSetting 
            ? `あなたは${characterSetting}として振る舞ってください。回答は${maxLength}文字以内で簡潔にお願いします。`
            : `回答は${maxLength}文字以内で簡潔にお願いします。`;

        const fullMessage = systemPrompt + '\n\n' + message;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: fullMessage
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: Math.ceil(maxLength * 1.5)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API エラー: ${response.status}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async handleOpenAIRequest(message, apiKey, model, maxLength, characterSetting) {
        const systemPrompt = characterSetting 
            ? `あなたは${characterSetting}として振る舞ってください。回答は${maxLength}文字以内で簡潔にお願いします。`
            : `回答は${maxLength}文字以内で簡潔にお願いします。`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: Math.ceil(maxLength * 1.5)
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API エラー: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async handleGroqRequest(message, apiKey, model, maxLength, characterSetting) {
        const systemPrompt = characterSetting 
            ? `あなたは${characterSetting}として振る舞ってください。回答は${maxLength}文字以内で簡潔にお願いします。`
            : `回答は${maxLength}文字以内で簡潔にお願いします。`;

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                max_tokens: Math.ceil(maxLength * 1.5)
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API エラー: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    // AIVIS API 直接呼び出し
    async playTextToSpeechDirect(text, modelId) {
        const apiKeys = this.getStoredApiKeys();
        const aivisApiKey = apiKeys.aivis;
        
        if (!aivisApiKey) {
            throw new Error('AIVIS APIキーが設定されていません');
        }

        const response = await fetch('https://api.aivis-project.com/v1/text-to-speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${aivisApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: modelId,
                quality: this.audioQuality.value || 'medium'
            })
        });

        if (!response.ok) {
            throw new Error(`AIVIS API エラー: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            audio.volume = parseFloat(this.volumeSlider.value);
            audio.playbackRate = parseFloat(this.speedSlider.value);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.resetPlaybackState();
                resolve();
            };
            
            audio.onerror = () => {
                URL.revokeObjectURL(audioUrl);
                this.resetPlaybackState();
                reject(new Error('音声再生エラー'));
            };
            
            this.currentAudio = audio;
            this.isPlaying = true;
            this.stopBtn.disabled = false;
            
            audio.play().catch(reject);
        });
    }

    // メッセージ送信処理
    async handleSendMessage() {
        const message = this.textInput.value.trim();
        if (!message) return;

        const currentApiKey = this.getCurrentApiKey();
        if (!currentApiKey) {
            this.showError(`${this.currentAiProvider}のAPIキーが設定されていません`);
            return;
        }

        this.addUserMessage(message);
        this.textInput.value = '';
        this.updateCharacterCount();
        this.showLoading(true);

        try {
            const model = this.getSelectedModel();
            const maxLength = parseInt(this.maxLength.value) || 100;
            const characterSetting = this.characterSetting.value.trim();

            const response = await this.sendMessageToAI(
                message, 
                this.currentAiProvider, 
                model, 
                maxLength, 
                characterSetting
            );

            this.addAssistantMessage(response);
            
            // 音声再生
            if (this.modelSelect.value) {
                await this.playTextToSpeechDirect(response, this.modelSelect.value);
            }

        } catch (error) {
            this.showError(`エラー: ${error.message}`);
            this.addAssistantMessage('申し訳ありません。エラーが発生しました。');
        } finally {
            this.showLoading(false);
        }
    }

    getSelectedModel() {
        const models = this.getStoredModels();
        return models[this.currentAiProvider] || this.getDefaultModel(this.currentAiProvider);
    }

    getDefaultModel(provider) {
        const defaults = {
            'gemini': 'gemini-1.5-flash',
            'openai': 'gpt-4o-mini',
            'groq': 'llama-3.3-70b-versatile'
        };
        return defaults[provider] || '';
    }

    // モデル管理
    getStoredModels() {
        try {
            const models = localStorage.getItem('ai_models');
            return models ? JSON.parse(models) : {};
        } catch (error) {
            return {};
        }
    }

    saveModel(provider, model) {
        try {
            const models = this.getStoredModels();
            models[provider] = model;
            localStorage.setItem('ai_models', JSON.stringify(models));
        } catch (error) {
        }
    }

    loadModels() {
        const models = this.getStoredModels();
        
        // 各AIプロバイダーのモデル選択を設定
        Object.keys(models).forEach(provider => {
            const selectElement = document.getElementById(`${provider}Model`);
            if (selectElement && models[provider]) {
                selectElement.value = models[provider];
            }
        });
    }

    // AIVIS モデル一覧読み込み
    async loadModels() {
        try {
            const apiKeys = this.getStoredApiKeys();
            const aivisApiKey = apiKeys.aivis;
            
            if (!aivisApiKey) {
                this.modelSelect.innerHTML = '<option value="">AIVIS APIキーを設定してください</option>';
                return;
            }

            this.modelSelect.innerHTML = '<option value="">モデルを読み込み中...</option>';
            
            const response = await fetch('https://api.aivis-project.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${aivisApiKey}`
                }
            });

            if (!response.ok) {
                throw new Error(`モデル取得エラー: ${response.status}`);
            }

            const data = await response.json();
            this.populateModelSelect(data.models || []);
            
        } catch (error) {
            this.modelSelect.innerHTML = '<option value="">モデル読み込みエラー</option>';
        }
    }

    populateModelSelect(models) {
        // 既存のカスタムモデルを保持
        const existingCustom = Array.from(this.modelSelect.options)
            .filter(option => option.dataset.custom === 'true')
            .map(option => ({value: option.value, text: option.text}));

        this.modelSelect.innerHTML = '<option value="">モデルを選択してください</option>';

        // モデルをグループ分け
        const groupedModels = {};
        models.forEach(model => {
            const group = model.group || 'その他';
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
                option.value = model.id;
                option.textContent = model.name;
                option.title = model.description || '';
                optgroup.appendChild(option);
            });
            
            this.modelSelect.appendChild(optgroup);
        });

        // カスタムモデルを追加
        if (existingCustom.length > 0) {
            const customGroup = document.createElement('optgroup');
            customGroup.label = 'カスタムモデル';
            
            existingCustom.forEach(custom => {
                const option = document.createElement('option');
                option.value = custom.value;
                option.textContent = custom.text;
                option.dataset.custom = 'true';
                customGroup.appendChild(option);
            });
            
            this.modelSelect.appendChild(customGroup);
        }
    }

    addCustomModel() {
        const customId = this.customModelId.value.trim();
        if (!customId) {
            alert('カスタムモデルUUIDを入力してください');
            return;
        }

        const existingOption = Array.from(this.modelSelect.options)
            .find(option => option.value === customId);
        
        if (existingOption) {
            alert('このモデルは既に追加されています');
            return;
        }

        // カスタムグループを取得または作成
        let customGroup = Array.from(this.modelSelect.querySelectorAll('optgroup'))
            .find(group => group.label === 'カスタムモデル');
        
        if (!customGroup) {
            customGroup = document.createElement('optgroup');
            customGroup.label = 'カスタムモデル';
            this.modelSelect.appendChild(customGroup);
        }

        const option = document.createElement('option');
        option.value = customId;
        option.textContent = `カスタム: ${customId.substring(0, 8)}...`;
        option.dataset.custom = 'true';
        customGroup.appendChild(option);

        this.modelSelect.value = customId;
        this.customModelId.value = '';
        
        this.saveSettings();
    }

    // UI関連
    addUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'user-message';
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
        `;
        this.chatHistory.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addAssistantMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'assistant-message';
        messageDiv.innerHTML = `
            <div class="message-content">${this.escapeHtml(message)}</div>
            <div class="message-controls">
                <button class="play-message-btn" onclick="app.playMessageText('${this.escapeHtml(message).replace(/'/g, "\\'")}')">🔊</button>
            </div>
        `;
        this.chatHistory.appendChild(messageDiv);
        this.scrollToBottom();
    }

    async playMessageText(text) {
        if (!this.modelSelect.value) {
            alert('音声モデルを選択してください');
            return;
        }

        try {
            await this.playTextToSpeechDirect(text, this.modelSelect.value);
        } catch (error) {
            alert('音声再生に失敗しました');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    clearChatHistory() {
        this.chatHistory.innerHTML = `
            <div class="welcome-message">
                <div class="assistant-message">
                    <div class="message-content">こんにちは！何でもお気軽にお話しください。AIが返答し、音声で読み上げます。</div>
                </div>
            </div>
        `;
    }

    updateCharacterCount() {
        this.charCount.textContent = this.textInput.value.length;
    }

    showLoading(show) {
        if (show) {
            this.loadingIndicator.classList.remove('hidden');
            this.sendBtn.disabled = true;
        } else {
            this.loadingIndicator.classList.add('hidden');
            this.sendBtn.disabled = false;
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        setTimeout(() => {
            this.errorMessage.classList.add('hidden');
        }, 5000);
    }

    // 音声制御
    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);
        } catch (error) {
        }
    }

    stopPlayback() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        this.resetPlaybackState();
    }

    resetPlaybackState() {
        this.isPlaying = false;
        this.stopBtn.disabled = true;
    }

    // 設定管理
    saveSettings() {
        const settings = {
            speed: this.speedSlider.value,
            volume: this.volumeSlider.value,
            aiProvider: this.aiProvider.value,
            maxLength: this.maxLength.value,
            audioQuality: this.audioQuality.value,
            selectedModel: this.modelSelect.value
        };
        
        localStorage.setItem('tts_app_settings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('tts_app_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                if (settings.speed) {
                    this.speedSlider.value = settings.speed;
                    this.speedValue.textContent = settings.speed;
                }
                
                if (settings.volume) {
                    this.volumeSlider.value = settings.volume;
                    this.volumeValue.textContent = settings.volume;
                }
                
                if (settings.aiProvider) {
                    this.aiProvider.value = settings.aiProvider;
                    this.currentAiProvider = settings.aiProvider;
                    this.handleProviderChange();
                }
                
                if (settings.maxLength) {
                    this.maxLength.value = settings.maxLength;
                }
                
                if (settings.audioQuality) {
                    this.audioQuality.value = settings.audioQuality;
                }
                
                if (settings.selectedModel) {
                    setTimeout(() => {
                        this.modelSelect.value = settings.selectedModel;
                    }, 100);
                }
            }
        } catch (error) {
        }
    }

    saveCharacterSetting() {
        const characterText = this.characterSetting.value;
        try {
            localStorage.setItem('character_setting', characterText);
        } catch (error) {
        }
    }

    loadCharacterSetting() {
        try {
            return localStorage.getItem('character_setting') || '';
        } catch (error) {
            return '';
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
            const apiKeys = this.getStoredApiKeys();
            if (apiKeys[provider] && apiKeys[provider].trim()) {
                const statusElement = document.getElementById(`${provider}Status`);
                statusElement.textContent = 'APIキーが設定されています';
                statusElement.className = 'api-status connected';
            }
        } else {
            // 全体のAPIステータスを更新
            const currentApiKey = this.getCurrentApiKey();
            if (currentApiKey && currentApiKey.trim()) {
                document.getElementById('apiStatus').textContent = `${providerNames[this.currentAiProvider]}のAPIキーが設定されています`;
                document.getElementById('apiStatus').className = 'api-status connected';
            } else {
                document.getElementById('apiStatus').textContent = 'APIキーが設定されていません';
                document.getElementById('apiStatus').className = 'api-status disconnected';
            }
            
            const currentApiKey2 = this.getCurrentApiKey();
            this.sendBtn.disabled = !currentApiKey2 || !currentApiKey2.trim();
        }
    }
}

// アプリケーション初期化
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TextToSpeechApp();
});