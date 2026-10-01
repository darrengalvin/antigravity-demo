/**
 * ANTIGRAVITY Sound Synthesizer Engine
 * 100% Procedural Web Audio API - Zero External Audio Files
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterGain = null;
    this.initialized = false;

    // Thruster continuous node references
    this.thrustNoiseNode = null;
    this.thrustNoiseGain = null;
    this.thrustFilter = null;
    this.thrustHumOsc = null;
    this.thrustHumGain = null;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupThrusterLoop();
      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  setupThrusterLoop() {
    if (!this.ctx) return;

    // Generate 2 seconds of pink/white noise in a buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    this.thrustNoiseNode = this.ctx.createBufferSource();
    this.thrustNoiseNode.buffer = noiseBuffer;
    this.thrustNoiseNode.loop = true;

    this.thrustFilter = this.ctx.createBiquadFilter();
    this.thrustFilter.type = "lowpass";
    this.thrustFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.thrustNoiseGain = this.ctx.createGain();
    this.thrustNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.thrustNoiseNode.connect(this.thrustFilter);
    this.thrustFilter.connect(this.thrustNoiseGain);
    this.thrustNoiseGain.connect(this.masterGain);

    // Sub-bass hum oscillator
    this.thrustHumOsc = this.ctx.createOscillator();
    this.thrustHumOsc.type = "sawtooth";
    this.thrustHumOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

    const humFilter = this.ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.setValueAtTime(110, this.ctx.currentTime);

    this.thrustHumGain = this.ctx.createGain();
    this.thrustHumGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.thrustHumOsc.connect(humFilter);
    humFilter.connect(this.thrustHumGain);
    this.thrustHumGain.connect(this.masterGain);

    this.thrustNoiseNode.start();
    this.thrustHumOsc.start();
  }

  setThrusterActive(active, isBoosting = false) {
    if (!this.initialized || this.isMuted || !this.ctx) return;

    const t = this.ctx.currentTime;
    if (active) {
      const targetGain = isBoosting ? 0.35 : 0.16;
      const targetFreq = isBoosting ? 1200 : 550;
      const targetHum = isBoosting ? 0.18 : 0.08;

      this.thrustNoiseGain.gain.setTargetAtTime(targetGain, t, 0.05);
      this.thrustFilter.frequency.setTargetAtTime(targetFreq, t, 0.08);
      this.thrustHumGain.gain.setTargetAtTime(targetHum, t, 0.05);
    } else {
      this.thrustNoiseGain.gain.setTargetAtTime(0.0001, t, 0.08);
      this.thrustHumGain.gain.setTargetAtTime(0.0001, t, 0.08);
    }
  }

  playRepulsorBlast() {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(450, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.45);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + 0.45);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.52);
  }

  playPickup(comboMultiplier = 1) {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Harmonic pentatonic frequencies scaled with combo
    const baseFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    const pitchShift = Math.min(comboMultiplier * 0.1, 1.0);

    baseFreqs.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      const startAt = t + index * 0.045;
      const targetFreq = freq * (1 + pitchShift);

      osc.frequency.setValueAtTime(targetFreq, startAt);
      osc.frequency.exponentialRampToValueAtTime(targetFreq * 1.5, startAt + 0.18);

      gain.gain.setValueAtTime(0.12, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startAt);
      osc.stop(startAt + 0.24);
    });
  }

  playCollision() {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Low crunch impact
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.36);
  }

  playGameOver() {
    if (!this.initialized || this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;

    [220, 196, 174, 130].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      const startAt = t + idx * 0.15;
      osc.frequency.setValueAtTime(freq, startAt);
      osc.frequency.exponentialRampToValueAtTime(35, startAt + 0.6);

      gain.gain.setValueAtTime(0.25, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.7);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(startAt);
      osc.stop(startAt + 0.75);
    });
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }
}

window.soundEngine = new SoundEngine();
