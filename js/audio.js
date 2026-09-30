// 사운드 4종(match / special / clear / chain).
// assets/sounds/에 파일이 있으면 그 파일을, 없으면 Web Audio로 합성한 효과음을 쓴다.
// chain은 연쇄 단계마다 반음씩 피치가 올라간다(semitone 인자).

const MUTE_KEY = 'bosses-of-our-world.muted';

export class Sound {
  constructor(cfg) {
    this.enabled = !!cfg.SOUND_ENABLED;
    this.synthOn = cfg.SOUND_SYNTH !== false;
    this.files = cfg.SOUNDS || {};
    this.volume = cfg.SOUND_VOLUME ?? 0.8;
    this.ctx = null;
    this.buffers = {};
    this.noiseBuf = null;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { this.muted = false; }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (_) { /* 무시 */ }
    if (!m) this.unlock();
  }

  // 첫 사용자 입력 때 호출 (모바일 오디오 잠금 해제)
  unlock() {
    if (!this.enabled || this.muted) return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.ctx.destination);
    for (const [name, url] of Object.entries(this.files)) {
      if (!url) continue;
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((decoded) => { this.buffers[name] = decoded; })
        .catch(() => { /* 파일 없으면 합성음 */ });
    }
  }

  play(name, semitone = 0) {
    if (!this.enabled || this.muted || !this.ctx) return;
    const buf = this.buffers[name];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, semitone / 12);
      src.connect(this.gain);
      src.start();
    } else if (this.synthOn) {
      this.synth(name, semitone);
    }
  }

  // ---------- 합성 효과음 ----------

  tone(type, f0, f1, dur, vol, delay = 0) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, freq, delay = 0) {
    const ctx = this.ctx;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.gain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  synth(name, semitone) {
    const k = Math.pow(2, semitone / 12);
    switch (name) {
      case 'match': // 뽁
        this.tone('sine', 620, 160, 0.13, 0.55);
        this.tone('triangle', 1240, 400, 0.06, 0.15);
        this.noise(0.05, 0.3, 2400);
        break;
      case 'chain': // 연쇄: 반음씩 올라가는 띠링
        this.tone('triangle', 700 * k, 1050 * k, 0.1, 0.35);
        this.tone('sine', 1400 * k, 1400 * k, 0.16, 0.12, 0.04);
        break;
      case 'special': // 쾅
        this.tone('sine', 180, 38, 0.5, 0.9);
        this.tone('square', 90, 30, 0.25, 0.15);
        this.noise(0.4, 0.7, 700);
        break;
      case 'clear': // 빠밤빠밤
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.3, i * 0.08));
        this.noise(0.6, 0.25, 5000, 0.35);
        break;
      default:
        break;
    }
  }
}
