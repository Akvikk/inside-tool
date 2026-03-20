(function () {
    'use strict';

    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.masterVolume = 0.2;
            this.enabled = true;
        }

        init() {
            if (this.ctx) return;
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('[AudioEngine] Web Audio not supported:', e);
            }
        }

        playTone(freq, duration, type = 'sine', volume = 0.1) {
            if (!this.enabled || !this.ctx) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        }

        playWin() {
            this.init();
            // Upward arpeggio
            this.playTone(523.25, 0.2, 'triangle', 0.2); // C5
            setTimeout(() => this.playTone(659.25, 0.2, 'triangle', 0.2), 100); // E5
            setTimeout(() => this.playTone(783.99, 0.4, 'triangle', 0.3), 200); // G5
        }

        playLoss() {
            this.init();
            // Downward slide
            this.playTone(220.00, 0.3, 'sawtooth', 0.1); // A3
            setTimeout(() => this.playTone(110.00, 0.5, 'sawtooth', 0.05), 100); // A2
        }

        playChip() {
            this.init();
            // Short pluck
            this.playTone(1200, 0.05, 'sine', 0.15);
        }

        toggle(state) {
            this.enabled = (state !== undefined) ? state : !this.enabled;
        }
    }

    window.AudioEngine = new AudioEngine();
})();
