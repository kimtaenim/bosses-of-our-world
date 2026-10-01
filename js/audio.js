// 효과음. assets/sounds/<이름>.mp3가 있으면 그 파일을, 없으면 Web Audio로 합성한다.
//   match   매치(모든 인물 공통): 점액질 "철퍼덕" 4종 돌려가며
//   land    타일이 내려앉을 때: 마림바 "또르르" (연달아 앉으면 음이 계단처럼 올라감)
//   chain   연쇄: 반음씩 올라가는 카주 (semitone 인자)
//   special_<종류>  특수 타일이 터질 때 (그림 emblem으로 고름, SPECIAL_KIND)
//     fart 국기 3종(3×3 폭탄) 방귀 / car 테슬라 부르릉 / rocket 로켓 콰광
//     robot 로봇 삐리비리 / oil 석유 출렁 철퍽 / sns 좋아요 띠링 / boom 그 밖
//   clear   판 클리어

const MUTE_KEY = 'bosses-of-our-world.muted';

// 같은 이름 소리의 최소 간격(ms). 특수 타일 여러 개가 동시에 터져도 귀가 찢어지지 않게.
const MIN_GAP = { match: 45, chain: 40, clear: 300, special: 90, land: 32 };

// 마림바 음계 (C 메이저 펜타토닉, 두 옥타브 반)
const MARIMBA = [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349];

// 특수 타일 그림(emblem) → 효과음 종류
export const SPECIAL_KIND = { us: 'fart', nk: 'fart', ru: 'fart', car: 'car', rocket: 'rocket', robot: 'robot', oil: 'oil', sns: 'sns' };

export class Sound {
  constructor(cfg) {
    this.enabled = !!cfg.SOUND_ENABLED;
    this.synthOn = cfg.SOUND_SYNTH !== false;
    this.files = cfg.SOUNDS || {};
    this.volume = cfg.SOUND_VOLUME ?? 0.8;
    this.ctx = null;
    this.buffers = {};
    this.noiseBuf = null;
    this.last = {};
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { this.muted = false; }
    this.bindUnlock();
  }

  // 끄면 오디오를 재우고, 다시 켜면 (버튼 탭 안에서) 깨워서 바로 소리가 나게 한다
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (_) { /* 무시 */ }
    if (m) {
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    } else {
      this.unlock();
      this.poke();
    }
  }

  // 무음 1샘플 재생: iOS는 사용자 탭 안에서 소리를 한 번 내야 오디오가 확실히 풀린다
  poke() {
    if (!this.ctx) return;
    try {
      const blank = this.ctx.createBufferSource();
      blank.buffer = this.ctx.createBuffer(1, 1, 22050);
      blank.connect(this.ctx.destination);
      blank.start(0);
    } catch (_) { /* 무시 */ }
  }

  // 모바일 오디오 잠금 해제: 화면 어디를 눌러도, 앱으로 돌아올 때도 다시 깨운다.
  // (iOS는 백그라운드에 다녀오면 'interrupted', 안드로이드는 'suspended'로 멈춰 소리가 끊긴다)
  bindUnlock() {
    if (typeof document === 'undefined') return;
    const wake = () => this.unlock();
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
      document.addEventListener(ev, wake, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.resume(); });
    window.addEventListener('pageshow', () => this.resume());
  }

  resume() {
    if (this.muted || !this.ctx) return Promise.resolve();
    if (this.ctx.state === 'closed') { this.ctx = null; return Promise.resolve(); } // 다음 탭에서 새로 만듦
    if (this.ctx.state === 'running') return Promise.resolve();
    return this.ctx.resume().catch(() => {});
  }

  unlock() {
    if (!this.enabled || this.muted) return;
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    // iOS: 무음 스위치가 켜져 있어도 게임 소리가 나도록 (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (_) { /* 무시 */ }
    this.ctx = new AC();
    // 여러 소리가 겹쳐도 찢어지지 않게 컴프레서를 거친다
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 6;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.15;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.volume;
    this.gain.connect(this.comp).connect(this.ctx.destination);
    this.poke();
    this.resume();
    for (const [name, url] of Object.entries(this.files)) {
      if (!url) continue;
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((decoded) => { this.buffers[name] = decoded; })
        .catch(() => { /* 파일 없으면 합성음 */ });
    }
  }

  // 특수 타일이 터질 때: 인물의 emblem으로 소리 종류를 고른다
  special(ch) {
    this.play(`special_${SPECIAL_KIND[ch && ch.emblem] || 'boom'}`);
  }

  play(name, semitone = 0) {
    if (!this.enabled || this.muted || !this.ctx) return;
    // 오디오가 잠들어 있으면 깨운 뒤에 재생 (소리를 버리지 않음)
    if (this.ctx.state !== 'running') {
      if (this.waking) return;
      this.waking = true;
      this.resume().then(() => {
        this.waking = false;
        if (this.ctx && this.ctx.state === 'running') this.play(name, semitone);
      });
      return;
    }
    const now = performance.now();
    const gap = MIN_GAP[name] ?? (name.startsWith('special_') ? MIN_GAP.special : 0);
    if (now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    const buf = this.buffers[name];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, semitone / 12);
      src.connect(this.gain);
      src.start();
    } else if (this.synthOn) {
      try { this.synth(name, semitone); } catch (_) { /* 합성 실패는 무시 */ }
    }
  }

  // ---------- 합성 재료 ----------

  get t0() { return this.ctx.currentTime + 0.01; }

  env(g, t, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  tone(type, f0, f1, dur, vol, delay = 0) {
    const ctx = this.ctx;
    const t = this.t0 + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, vol, 0.005, dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noiseSrc() {
    const ctx = this.ctx;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    return src;
  }

  // 필터를 훑는 노이즈 (type: lowpass/bandpass/highpass, 주파수 f0 → f1)
  noise(dur, vol, f0, delay = 0, type = 'bandpass', f1 = f0, q = 0.8) {
    const ctx = this.ctx;
    const t = this.t0 + delay;
    const src = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.gain);
    src.start(t, Math.random() * 0.4);
    src.stop(t + dur + 0.03);
  }

  // ---- 점액질 재료 ----

  // 기포 "뽀글": 공명하는 기포가 터질 때처럼 음이 위로 휙 올라가는 짧은 사인
  bubble(start, f0, dur = 0.03, vol = 0.25) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // 질척임: 노이즈를 공명 필터로 훑으면서 필터를 출렁출렁 흔든다 (끈적한 "쮸왑")
  squelch(start, dur, fA, fB, vol, q = 9, wob = 18, type = 'lowpass') {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const src = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const g = ctx.createGain();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(fA, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, fB), t + dur);
    lfo.frequency.setValueAtTime(wob, t);
    lfo.frequency.linearRampToValueAtTime(wob * 0.5, t + dur);
    lg.gain.value = Math.min(fA, fB) * 0.6;
    lfo.connect(lg).connect(f.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.7, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.gain);
    lfo.start(t);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.03);
    lfo.stop(t + dur + 0.03);
  }

  // 덩어리가 떨어지는 저음 "퍽"
  thump(start, f, vol, dur = 0.12) {
    this.tone('sine', f * 2.2, f * 0.7, dur, vol, start);
  }

  // 점액질 "철퍼덕" 4종을 돌려가며 (같은 게 연달아 나오지 않게). variant를 주면 그걸로.
  splat(size = 1, delay = 0, variant = -1) {
    let v = variant;
    if (v < 0) {
      v = Math.floor(Math.random() * 3);
      if (v >= (this.lastSplat ?? -1)) v++;
      this.lastSplat = v;
    }
    const z = Math.min(size, 1.6);
    const p = 0.88 + Math.random() * 0.26;
    const d = delay;
    switch (v) {
      case 0: // "철퍼덕": 퍽 + 아래로 훑는 끈적한 노이즈 + 뒤따르는 기포
        this.thump(d, 70 * p, 0.7 * z);
        this.squelch(d, 0.22 + 0.08 * z, 2400 * p, 180, 0.9 * z, 10, 22);
        this.squelch(d + 0.05, 0.16, 900 * p, 300, 0.4 * z, 14, 30, 'bandpass');
        for (let i = 0; i < 4; i++) this.bubble(d + 0.1 + i * 0.045 + Math.random() * 0.02, (380 + Math.random() * 300) * p, 0.03, 0.22);
        break;
      case 1: // "쮸왑": 빨아들였다 뱉는 와우 (필터가 올라갔다 내려감)
        this.squelch(d, 0.11, 250 * p, 1800 * p, 0.7 * z, 12, 26);
        this.squelch(d + 0.1, 0.2 + 0.06 * z, 1800 * p, 200, 0.85 * z, 12, 16);
        this.thump(d + 0.09, 60 * p, 0.6 * z, 0.14);
        this.bubble(d + 0.28, 300 * p, 0.05, 0.25);
        this.bubble(d + 0.36, 460 * p, 0.04, 0.18);
        break;
      case 2: // "뿌지직 뽀글뽀글": 기포가 한꺼번에 터지며 질척
        this.squelch(d, 0.2, 1600 * p, 250, 0.7 * z, 7, 34);
        this.thump(d, 85 * p, 0.5 * z, 0.1);
        for (let i = 0; i < 9; i++) this.bubble(d + i * 0.022 + Math.random() * 0.015, (250 + Math.random() * 600) * p, 0.025 + Math.random() * 0.02, 0.2);
        break;
      default: // "철벅 철벅": 두 번 철썩 (덩어리가 튀었다 다시 떨어짐)
        this.thump(d, 65 * p, 0.7 * z);
        this.squelch(d, 0.14, 2000 * p, 220, 0.85 * z, 9, 20);
        this.thump(d + 0.16, 80 * p, 0.45 * z, 0.1);
        this.squelch(d + 0.16, 0.18, 1400 * p, 160, 0.6 * z, 11, 24);
        this.bubble(d + 0.34, 520 * p, 0.035, 0.18);
        break;
    }
  }

  // 금관 한 음: 톱니파 + 열리는 로우패스 + 비브라토. bend가 음수면 끝에서 축 처짐.
  brass(freq, start, dur, vol = 0.22, bend = 0) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    o.type = o2.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    o2.frequency.setValueAtTime(freq * 1.006, t);
    if (bend) {
      const end = freq * Math.pow(2, bend / 12);
      o.frequency.setValueAtTime(freq, t + dur * 0.45);
      o.frequency.exponentialRampToValueAtTime(end, t + dur);
      o2.frequency.setValueAtTime(freq * 1.006, t + dur * 0.45);
      o2.frequency.exponentialRampToValueAtTime(end * 1.01, t + dur);
    }
    vib.frequency.value = 6;
    vg.gain.value = freq * 0.012;
    vib.connect(vg);
    vg.connect(o.frequency);
    vg.connect(o2.frequency);
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(freq * 1.2, t);
    f.frequency.exponentialRampToValueAtTime(freq * 6, t + 0.05);
    f.frequency.exponentialRampToValueAtTime(freq * 2.5, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f);
    f.connect(g).connect(this.gain);
    for (const x of [o, o2, vib]) { x.start(t); x.stop(t + dur + 0.03); }
  }

  // 카주: 톱니파를 좁은 대역으로 → 콧소리 "뿌우"
  kazoo(freq, start, dur, vol = 0.18) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
    vib.frequency.value = 9;
    vg.gain.value = freq * 0.02;
    vib.connect(vg).connect(o.frequency);
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 3;
    this.env(g, t, vol, 0.01, dur);
    o.connect(f).connect(g).connect(this.gain);
    for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.03); }
  }

  // 방귀: 떨리는 저음 톱니파를 공명 로우패스로 + 진폭을 빠르게 덜덜 → "뿌우우웅~" 끝에 "뿡"
  fart(size = 1, delay = 0) {
    const ctx = this.ctx;
    const t = this.t0 + delay;
    const p = 0.8 + Math.random() * 0.45;
    const dur = (0.55 + Math.random() * 0.25) * size;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const am = ctx.createGain();
    const flut = ctx.createOscillator();
    const fg = ctx.createGain();
    const wob = ctx.createOscillator();
    const wg = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70 * p, t);
    o.frequency.linearRampToValueAtTime(115 * p, t + 0.06);
    o.frequency.linearRampToValueAtTime(92 * p, t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(60 * p, t + dur);
    wob.frequency.value = 6 + Math.random() * 4; // 꾸르륵 흔들림
    wg.gain.value = 14 * p;
    wob.connect(wg).connect(o.frequency);
    flut.type = 'square';
    flut.frequency.setValueAtTime(34 * p, t); // 덜덜덜 (괄약근)
    flut.frequency.linearRampToValueAtTime(22 * p, t + dur);
    fg.gain.value = 0.45;
    am.gain.value = 0.55;
    flut.connect(fg).connect(am.gain);
    f.type = 'lowpass';
    f.Q.value = 7;
    f.frequency.setValueAtTime(700 * p, t);
    f.frequency.linearRampToValueAtTime(420 * p, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
    g.gain.setValueAtTime(0.8, t + dur * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(am).connect(g).connect(this.gain);
    for (const x of [o, flut, wob]) { x.start(t); x.stop(t + dur + 0.03); }
    // 바람 새는 소리
    this.noise(dur, 0.18, 320 * p, delay, 'bandpass', 180, 2);
    // 마무리 "뿡"
    this.tone('sawtooth', 130 * p, 70 * p, 0.09, 0.35, delay + dur + 0.04);
    this.noise(0.08, 0.25, 400, delay + dur + 0.04, 'lowpass', 150, 3);
  }

  // 엔진 "부르릉": 톱니파 회전수를 올렸다 내리고, 폭발 간격으로 진폭을 덜덜
  engine(start, dur, f0, f1, f2, vol = 0.5) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const o = ctx.createOscillator();
    const am = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    lfo.type = 'square';
    for (const [osc, k] of [[o, 1], [lfo, 0.5]]) {
      osc.frequency.setValueAtTime(f0 * k, t);
      osc.frequency.exponentialRampToValueAtTime(f1 * k, t + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(f2 * k, t + dur);
    }
    lg.gain.value = 0.5;
    am.gain.value = 0.5;
    lfo.connect(lg).connect(am.gain);
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + dur * 0.45);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    this.env(g, t, vol, 0.03, dur);
    o.connect(f).connect(am).connect(g).connect(this.gain);
    for (const x of [o, lfo]) { x.start(t); x.stop(t + dur + 0.03); }
  }

  // 마림바 한 음: 기음 + 4배음(나무 건반 특유의 "통") + 짧은 타격음
  marimba(f, start = 0, vol = 0.22) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    for (const [m, v, dur] of [[1, 1, 0.45], [3.93, 0.28, 0.12], [9.2, 0.08, 0.04]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.gain);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  // ---------- 효과음 ----------

  synth(name, semitone) {
    const k = Math.pow(2, semitone / 12);
    switch (name) {
      case 'match': // 점액질 철퍼덕 (모든 인물 공통)
        this.splat(1);
        break;
      case 'land': { // 마림바 "또르르": 0.25초 안에 이어 앉으면 다음 음, 쉬었다 오면 처음부터
        const now = this.ctx.currentTime;
        this.roll = now - (this.rollAt || 0) > 0.25 ? 0 : (this.roll || 0) + 1;
        this.rollAt = now;
        this.marimba(MARIMBA[this.roll % MARIMBA.length]);
        break;
      }
      case 'chain': // 연쇄: 반음씩 올라가는 카주 "뿌-뿌우"
        this.kazoo(392 * k, 0, 0.09, 0.5);
        this.kazoo(523 * k, 0.08, 0.16, 0.55);
        break;
      case 'special_fart': // 국기 폭탄: 방귀 "뿌우우웅~뿡" + 질척
        this.fart(1);
        this.splat(1.2, 0.02);
        break;
      case 'special_car': // 테슬라: "부르릉 부릉~"
        this.engine(0, 0.32, 38, 95, 60, 0.8);
        this.engine(0.3, 0.6, 45, 150, 55, 0.95);
        this.noise(0.5, 0.15, 900, 0.3, 'bandpass', 400, 1); // 배기음
        break;
      case 'special_rocket': // 로켓: "콰-광!"
        this.noise(0.06, 0.8, 6000, 0, 'highpass', 2000, 0.7); // 콰 (찢어지는 소리)
        this.tone('sine', 160, 40, 0.3, 0.7);
        this.noise(0.3, 0.6, 3000, 0, 'lowpass', 300, 1);
        this.tone('sine', 110, 26, 0.9, 0.95, 0.12); // 광 (깊은 폭발)
        this.noise(1.0, 0.9, 2500, 0.12, 'lowpass', 70, 1.2);
        for (let i = 0; i < 8; i++) this.noise(0.03, 0.3, 1500 + Math.random() * 3000, 0.25 + Math.random() * 0.5, 'bandpass'); // 파편 타닥
        break;
      case 'special_robot': { // 로봇: "삐리비리 삐리리"
        const seq = [1760, 1175, 2093, 1397, 1760, 988, 2349, 1568, 1976, 1319, 2637];
        seq.forEach((f, i) => {
          const s0 = i * 0.042;
          this.tone('square', f, f * (i % 2 ? 0.8 : 1.25), 0.038, 0.38, s0);
        });
        this.tone('sine', 660, 330, 0.18, 0.15, seq.length * 0.042); // 끝에 "뿅"
        break;
      }
      case 'special_oil': { // 석유: "출렁~ 철퍽!"
        const ctx = this.ctx;
        const t = this.t0;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.linearRampToValueAtTime(110, t + 0.4);
        lfo.frequency.setValueAtTime(5, t); // 출렁 출렁
        lfo.frequency.linearRampToValueAtTime(9, t + 0.4);
        lg.gain.value = 60;
        lfo.connect(lg).connect(o.frequency);
        this.env(g, t, 0.6, 0.04, 0.42);
        o.connect(g).connect(this.gain);
        for (const x of [o, lfo]) { x.start(t); x.stop(t + 0.45); }
        this.noise(0.4, 0.3, 500, 0, 'lowpass', 1200, 3); // 찰랑이는 물결
        this.splat(1.6, 0.3); // 철퍽
        this.splat(1.1, 0.38);
        [0.62, 0.74, 0.83].forEach((s) => this.tone('sine', 700 + Math.random() * 400, 1400, 0.05, 0.12, s)); // 뚝뚝
        break;
      }
      case 'special_sns': // SNS: 철퍽 + 좋아요 알림 "띠링~"
        this.splat(1.3);
        this.tone('sine', 1047, 1047, 0.12, 0.3, 0.05);
        this.tone('sine', 1568, 1568, 0.25, 0.27, 0.13);
        this.tone('sine', 2093, 2093, 0.3, 0.16, 0.22);
        break;
      case 'special_boom': // 그 밖: 철퍼덕 쾅
        this.splat(1.6);
        this.splat(1.2, 0.07);
        this.tone('sine', 140, 32, 0.55, 0.8);
        this.noise(0.45, 0.6, 900, 0, 'lowpass', 120, 1);
        break;
      case 'clear': // 지나치게 거창한 팡파레 + 심벌 + 박수 (끝에 트롬본 한 번 비틀)
        [[392, 0, 0.12], [392, 0.13, 0.12], [392, 0.26, 0.12], [523, 0.39, 0.5], [659, 0.92, 0.14], [784, 1.07, 0.7]]
          .forEach(([f, s, d]) => { this.brass(f, s, d, 0.2); this.brass(f / 2, s, d, 0.12); });
        this.noise(1.2, 0.35, 7000, 1.07, 'highpass', 5000, 0.5);
        for (let i = 0; i < 14; i++) this.noise(0.05, 0.18, 1800 + Math.random() * 1500, 1.15 + i * 0.06 + Math.random() * 0.04);
        this.brass(196, 1.75, 0.45, 0.14, -3);
        break;
      default:
        break;
    }
  }
}
