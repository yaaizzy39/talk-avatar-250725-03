class TextToSpeechApp {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.chatHistory = [];
        this.geminiApiKeyValue = localStorage.getItem('gemini_api_key') || '';
        this.audioContext = null;
        this.audioSource = null;
        this.gainNode = null;
        this.audioCache = new Map(); // 音声キャッシュ
        this.initializeElements();
        this.attachEventListeners();
        this.updateSliderValues();
        this.loadApiKey();
        this.loadSettings();
        this.loadAvailableModels();
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.chatHistoryEl = document.getElementById('chatHistory');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelInfo = document.getElementById('modelInfo');
        this.refreshModelsBtn = document.getElementById('refreshModelsBtn');
        this.customModelId = document.getElementById('customModelId');
        this.addModelBtn = document.getElementById('addModelBtn');
        this.availableModels = [];
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.geminiApiKey = document.getElementById('geminiApiKey');
        this.maxLength = document.getElementById('maxLength');
        this.audioQuality = document.getElementById('audioQuality');
        
        // 設定変更の監視
        this.maxLength.addEventListener('input', () => {
            this.saveSettings();
        });
        
        this.audioQuality.addEventListener('change', () => {
            this.saveSettings();
        });
        this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.apiStatus = document.getElementById('apiStatus');
        this.stopBtn = document.getElementById('stopBtn');
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

        // APIキー保存
        this.saveApiKeyBtn.addEventListener('click', () => {
            this.saveApiKey();
        });

        // モデル選択変更
        this.modelSelect.addEventListener('change', () => {
            this.updateModelInfo();
            this.saveSettings();
        });

        // モデル更新ボタン
        this.refreshModelsBtn.addEventListener('click', () => {
            this.loadAvailableModels();
        });

        // カスタムモデル追加
        this.addModelBtn.addEventListener('click', () => {
            this.addCustomModel();
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

    loadApiKey() {
        if (this.geminiApiKeyValue) {
            this.geminiApiKey.value = this.geminiApiKeyValue;
            this.updateApiStatus(true);
        } else {
            this.updateApiStatus(false);
        }
    }

    saveApiKey() {
        const apiKey = this.geminiApiKey.value.trim();
        if (!apiKey) {
            this.showError('APIキーを入力してください');
            return;
        }

        localStorage.setItem('gemini_api_key', apiKey);
        this.geminiApiKeyValue = apiKey;
        this.updateApiStatus(true);
        this.showStatus('APIキーを保存しました');
    }

    updateApiStatus(connected) {
        if (connected) {
            this.apiStatus.textContent = 'APIキーが設定されています';
            this.apiStatus.className = 'api-status connected';
            this.sendBtn.disabled = false;
        } else {
            this.apiStatus.textContent = 'APIキーが設定されていません';
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

        if (!this.geminiApiKeyValue) {
            this.showError('Gemini APIキーを設定してください');
            return;
        }

        // ユーザーメッセージを追加
        this.addMessageToChat('user', message);
        this.textInput.value = '';
        this.updateCharacterCount();

        // AIの返答を取得
        this.setLoadingState(true);
        this.hideError();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    apiKey: this.geminiApiKeyValue,
                    maxLength: parseInt(this.maxLength.value) || 100
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
            
            // 自動音声再生
            await this.playTextToSpeech(data.response);

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
        this.chatHistoryEl.scrollTop = this.chatHistoryEl.scrollHeight;
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

            console.log('新規音声生成:', text.substring(0, 20) + '...');
            console.log('使用モデル:', this.modelSelect.value);
            
            const requestData = {
                text: text,
                modelId: this.modelSelect.value,
                quality: this.audioQuality.value
            };

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`TTS API error: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('audio/')) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // キャッシュに保存（最大20件まで）
                if (this.audioCache.size >= 20) {
                    const firstKey = this.audioCache.keys().next().value;
                    URL.revokeObjectURL(this.audioCache.get(firstKey));
                    this.audioCache.delete(firstKey);
                }
                this.audioCache.set(cacheKey, audioUrl);
                
                await this.playAudioFromUrl(audioUrl);
            } else {
                const data = await response.json();
                if (data.status === 'error') {
                    throw new Error(data.message);
                }
                if (data.audioData) {
                    await this.playAudioFromBase64(data.audioData);
                }
            }
        } catch (error) {
            console.error('音声再生エラー:', error);
            // 音声エラーは表示しない（チャット機能を妨げないため）
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
            audioQuality: this.audioQuality.value
        };
        
        localStorage.setItem('tts_app_settings', JSON.stringify(settings));
        console.log('設定を保存しました:', settings);
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
                
                // モデル選択は後で復元（モデル一覧読み込み後）
                this.savedModelId = settings.selectedModel;
            }
        } catch (error) {
            console.error('設定の読み込みに失敗:', error);
        }
    }

    restoreModelSelection() {
        // モデル一覧読み込み後にモデル選択を復元
        if (this.savedModelId) {
            const option = Array.from(this.modelSelect.options).find(opt => opt.value === this.savedModelId);
            if (option) {
                this.modelSelect.value = this.savedModelId;
                this.updateModelInfo();
                console.log('モデル選択を復元しました:', this.savedModelId);
            }
            this.savedModelId = null; // 使用後はクリア
        }
    }

    async loadAvailableModels() {
        try {
            this.modelSelect.innerHTML = '<option value="">モデルを読み込み中...</option>';
            this.refreshModelsBtn.disabled = true;

            // サーバー経由でモデル一覧を取得
            const response = await fetch('/api/models');
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
            this.refreshModelsBtn.disabled = false;
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

        // 保存されたモデルを復元、なければ最初のモデルを選択
        this.restoreModelSelection();
        
        if (!this.modelSelect.value && this.availableModels.length > 0) {
            this.modelSelect.value = this.availableModels[0].uuid;
            this.updateModelInfo();
        } else if (!this.modelSelect.value) {
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
                this.playBtn.disabled = true;
                this.stopBtn.disabled = false;
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
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
                this.playBtn.disabled = true;
                this.stopBtn.disabled = false;
            });

            this.currentAudio.addEventListener('ended', () => {
                console.log('音声再生終了');
                this.resetPlaybackState();
                URL.revokeObjectURL(audioUrl);
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
        this.resetPlaybackState();
    }

    resetPlaybackState() {
        this.isPlaying = false;
        this.stopBtn.disabled = true;
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.loadingIndicator.classList.remove('hidden');
            this.sendBtn.disabled = true;
        } else {
            this.loadingIndicator.classList.add('hidden');
            if (this.geminiApiKeyValue) {
                this.sendBtn.disabled = false;
            }
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
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('テキスト読み上げアプリを初期化中...');
    new TextToSpeechApp();
    console.log('アプリケーション初期化完了');
});