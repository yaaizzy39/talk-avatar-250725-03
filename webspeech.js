class WebSpeechTTSApp {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.voices = [];
        this.isPlaying = false;
        this.isPaused = false;
        
        this.initializeElements();
        this.checkSupport();
        this.loadVoices();
        this.attachEventListeners();
        this.updateSliderValues();
    }

    initializeElements() {
        this.textInput = document.getElementById('textInput');
        this.charCount = document.getElementById('charCount');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.rateSlider = document.getElementById('rateSlider');
        this.rateValue = document.getElementById('rateValue');
        this.pitchSlider = document.getElementById('pitchSlider');
        this.pitchValue = document.getElementById('pitchValue');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeValue = document.getElementById('volumeValue');
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.statusMessage = document.getElementById('statusMessage');
        this.errorMessage = document.getElementById('errorMessage');
        this.supportCheck = document.getElementById('supportCheck');
    }

    checkSupport() {
        if (!('speechSynthesis' in window)) {
            this.showError('お使いのブラウザはWeb Speech APIに対応していません。');
            this.supportCheck.innerHTML = '<span style="color: red;">❌ Web Speech API非対応</span>';
            this.playBtn.disabled = true;
            return false;
        }
        
        this.supportCheck.innerHTML = '<span style="color: green;">✅ Web Speech API対応</span>';
        this.showStatus('Web Speech APIが利用可能です');
        return true;
    }

    loadVoices() {
        const populateVoices = () => {
            this.voices = this.synth.getVoices();
            this.voiceSelect.innerHTML = '';
            
            if (this.voices.length === 0) {
                this.voiceSelect.innerHTML = '<option value="">音声が見つかりません</option>';
                return;
            }

            // 日本語音声を優先して表示
            const japaneseVoices = this.voices.filter(voice => 
                voice.lang.includes('ja') || voice.lang.includes('JP')
            );
            const otherVoices = this.voices.filter(voice => 
                !voice.lang.includes('ja') && !voice.lang.includes('JP')
            );

            // 日本語音声を先に追加
            if (japaneseVoices.length > 0) {
                const jpGroup = document.createElement('optgroup');
                jpGroup.label = '日本語';
                japaneseVoices.forEach((voice, index) => {
                    const option = document.createElement('option');
                    option.value = this.voices.indexOf(voice);
                    option.textContent = `${voice.name} (${voice.lang})`;
                    jpGroup.appendChild(option);
                });
                this.voiceSelect.appendChild(jpGroup);
            }

            // その他の音声を追加
            if (otherVoices.length > 0) {
                const otherGroup = document.createElement('optgroup');
                otherGroup.label = 'その他の言語';
                otherVoices.forEach((voice, index) => {
                    const option = document.createElement('option');
                    option.value = this.voices.indexOf(voice);
                    option.textContent = `${voice.name} (${voice.lang})`;
                    otherGroup.appendChild(option);
                });
                this.voiceSelect.appendChild(otherGroup);
            }

            // デフォルトで最初の日本語音声を選択
            if (japaneseVoices.length > 0) {
                this.voiceSelect.value = this.voices.indexOf(japaneseVoices[0]);
            }

            this.showStatus(`${this.voices.length}個の音声が利用可能です`);
        };

        // 音声リストの読み込み
        populateVoices();
        
        // 音声が遅延読み込みされる場合のため
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = populateVoices;
        }
    }

    attachEventListeners() {
        // テキスト入力の文字数カウント
        this.textInput.addEventListener('input', () => {
            this.updateCharacterCount();
        });

        // スライダーの値更新
        this.rateSlider.addEventListener('input', () => {
            this.rateValue.textContent = this.rateSlider.value;
        });

        this.pitchSlider.addEventListener('input', () => {
            this.pitchValue.textContent = this.pitchSlider.value;
        });

        this.volumeSlider.addEventListener('input', () => {
            this.volumeValue.textContent = this.volumeSlider.value;
        });

        // 再生・停止ボタン
        this.playBtn.addEventListener('click', () => {
            if (this.isPaused) {
                this.resumeSpeech();
            } else {
                this.startSpeech();
            }
        });

        this.pauseBtn.addEventListener('click', () => {
            this.pauseSpeech();
        });

        this.stopBtn.addEventListener('click', () => {
            this.stopSpeech();
        });

        // キーボードショートカット
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                this.startSpeech();
            }
        });
    }

    updateCharacterCount() {
        const length = this.textInput.value.length;
        this.charCount.textContent = length;
    }

    updateSliderValues() {
        this.rateValue.textContent = this.rateSlider.value;
        this.pitchValue.textContent = this.pitchSlider.value;
        this.volumeValue.textContent = this.volumeSlider.value;
    }

    startSpeech() {
        const text = this.textInput.value.trim();
        
        if (!text) {
            this.showError('読み上げるテキストを入力してください');
            return;
        }

        // 既存の音声を停止
        this.stopSpeech();

        // 新しい発話を作成
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // 音声設定
        const selectedVoiceIndex = this.voiceSelect.value;
        if (selectedVoiceIndex && this.voices[selectedVoiceIndex]) {
            this.currentUtterance.voice = this.voices[selectedVoiceIndex];
        }
        
        this.currentUtterance.rate = parseFloat(this.rateSlider.value);
        this.currentUtterance.pitch = parseFloat(this.pitchSlider.value);
        this.currentUtterance.volume = parseFloat(this.volumeSlider.value);

        // イベントリスナー
        this.currentUtterance.addEventListener('start', () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.updateButtonStates();
            this.showStatus('読み上げ中...');
        });

        this.currentUtterance.addEventListener('end', () => {
            this.resetPlaybackState();
            this.showStatus('読み上げ完了');
        });

        this.currentUtterance.addEventListener('error', (e) => {
            this.resetPlaybackState();
            this.showError(`読み上げエラー: ${e.error}`);
        });

        this.currentUtterance.addEventListener('pause', () => {
            this.isPaused = true;
            this.updateButtonStates();
            this.showStatus('一時停止中');
        });

        this.currentUtterance.addEventListener('resume', () => {
            this.isPaused = false;
            this.updateButtonStates();
            this.showStatus('読み上げ再開');
        });

        // 読み上げ開始
        this.synth.speak(this.currentUtterance);
    }

    pauseSpeech() {
        if (this.isPlaying && !this.isPaused) {
            this.synth.pause();
        }
    }

    resumeSpeech() {
        if (this.isPaused) {
            this.synth.resume();
        }
    }

    stopSpeech() {
        this.synth.cancel();
        this.resetPlaybackState();
        this.showStatus('停止');
    }

    resetPlaybackState() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.updateButtonStates();
    }

    updateButtonStates() {
        this.playBtn.disabled = this.isPlaying && !this.isPaused;
        this.playBtn.textContent = this.isPaused ? '再開' : '読み上げ開始';
        this.pauseBtn.disabled = !this.isPlaying || this.isPaused;
        this.stopBtn.disabled = !this.isPlaying;
    }

    showStatus(message) {
        this.statusMessage.textContent = message;
        this.statusMessage.style.color = '#1976d2';
        this.hideError();
        
        // 3秒後に自動でクリア
        setTimeout(() => {
            if (this.statusMessage.textContent === message) {
                this.statusMessage.textContent = '';
            }
        }, 3000);
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
    console.log('Web Speech API テキスト読み上げアプリを初期化中...');
    new WebSpeechTTSApp();
    console.log('アプリケーション初期化完了');
});