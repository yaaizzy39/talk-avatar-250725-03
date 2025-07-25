class TextToSpeechApp {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.initializeElements();
        this.attachEventListeners();
        this.updateSliderValues();
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.modelSelect = document.getElementById('modelSelect');
        this.customModelId = document.getElementById('customModelId');
        this.addModelBtn = document.getElementById('addModelBtn');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.pitchSlider = document.getElementById('pitchSlider');
        this.pitchValue = document.getElementById('pitchValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.playBtn = document.getElementById('playBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorMessage = document.getElementById('errorMessage');
    }

    attachEventListeners() {
        // テキスト入力の文字数カウント
        this.textInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        // カスタムモデル追加
        this.addModelBtn.addEventListener('click', () => {
            this.addCustomModel();
        });

        // スライダーの値更新
        this.speedSlider.addEventListener('input', () => {
            this.speedValue.textContent = this.speedSlider.value;
        });

        this.pitchSlider.addEventListener('input', () => {
            this.pitchValue.textContent = this.pitchSlider.value;
        });

        this.volumeSlider.addEventListener('input', () => {
            this.volumeValue.textContent = this.volumeSlider.value;
            if (this.currentAudio) {
                this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            }
        });

        // 再生・停止ボタン
        this.playBtn.addEventListener('click', () => {
            this.generateAndPlaySpeech();
        });

        this.stopBtn.addEventListener('click', () => {
            this.stopSpeech();
        });

        // Enterキーでの再生開始（Ctrl+Enterまたはテキストエリア外でEnter）
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.generateAndPlaySpeech();
            }
        });
    }

    updateCharacterCount() {
        const length = this.textInput.value.length;
        this.charCount.textContent = length;
        
        // 文字数制限に近づいたら色を変更
        if (length > 180) {
            this.charCount.style.color = '#f44336';
        } else if (length > 150) {
            this.charCount.style.color = '#ff9800';
        } else {
            this.charCount.style.color = '#666';
        }
    }

    updateSliderValues() {
        this.speedValue.textContent = this.speedSlider.value;
        this.pitchValue.textContent = this.pitchSlider.value;
        this.volumeValue.textContent = this.volumeSlider.value;
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
        
        // 入力フィールドをクリア
        this.customModelId.value = '';
        
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
                modelId: this.modelSelect.value
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

            // 新しい音声を作成・再生
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            
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

            // 新しい音声を作成・再生
            this.currentAudio = new Audio(audioUrl);
            this.currentAudio.volume = parseFloat(this.volumeSlider.value);
            
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
        this.playBtn.disabled = false;
        this.stopBtn.disabled = true;
    }

    setLoadingState(isLoading) {
        if (isLoading) {
            this.loadingIndicator.classList.remove('hidden');
            this.playBtn.disabled = true;
        } else {
            this.loadingIndicator.classList.add('hidden');
            if (!this.isPlaying) {
                this.playBtn.disabled = false;
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