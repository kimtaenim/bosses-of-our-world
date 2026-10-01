// 효과음. assets/sounds/<이름>.mp3가 있으면 그 파일을, 없으면 Web Audio로 합성한다.
//   match   매치(모든 인물 공통): 점액질 "철퍼덕" 4종 돌려가며
//   land    타일이 내려앉을 때: 구슬 굴러가는 "또르르" (음 없이 똑딱)
//   miss    잘못 옮겼을 때: "아~ 오"
//   chain   연쇄: 반음씩 올라가는 카주 (semitone 인자)
//   special_<종류>  특수 타일이 터질 때 (그림 emblem으로 고름, SPECIAL_KIND)
//     anthem 성조기: 마림바 "솔미도미솔도" (성조기여 영원하라 첫 구절)
//     fart 인공기·러시아 국기 방귀 / car 테슬라 부르릉 / rocket 로켓 콰광
//     robot 로봇 삐리비리 / oil 석유 출렁 철퍽 / sns 좋아요 띠링 / drone 드론 위이잉 쾅 / boom 그 밖
//     dove 비둘기 민병대 푸드덕 타타타탕 / 시한폭탄은 rocket 콰광
//   beep    시한폭탄 카운트다운 삑
//   clear   판 클리어 (철퍼덕 와르르)

const MUTE_KEY = 'bosses-of-our-world.muted';

// 같은 이름 소리의 최소 간격(ms). 특수 타일 여러 개가 동시에 터져도 귀가 찢어지지 않게.
const MIN_GAP = { beep: 80, special_anthem: 3200, miss: 300, match: 45, chain: 40, clear: 300, special: 90, land: 18 };


// 특수 타일 그림(emblem) → 효과음 종류
export const SPECIAL_KIND = { globe: 'drone', timebomb: 'rocket', dove: 'dove', us: 'anthem', nk: 'fart', ru: 'fart', car: 'car', rocket: 'rocket', robot: 'robot', oil: 'oil', sns: 'sns' };

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
      this.silentTag(false);
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    } else {
      this.unlock();
      this.poke();
    }
  }

  // iOS 무음(진동) 모드에서도 소리가 나게: 무음 오디오 태그를 반복 재생해 두면
  // 웹 오디오가 '미디어 재생'으로 취급되어 무음 스위치에 막히지 않는다 (예전 iOS 포함)
  silentTag(on) {
    if (typeof document === 'undefined') return;
    if (!this.tag) {
      if (!on) return;
      const rate = 8000, n = 4000; // 0.5초짜리 무음 WAV
      const buf = new Uint8Array(44 + n);
      const dv = new DataView(buf.buffer);
      const w = (o, str) => { for (let i = 0; i < str.length; i++) buf[o + i] = str.charCodeAt(i); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
      dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
      buf.fill(128, 44);
      let bin = '';
      for (const b of buf) bin += String.fromCharCode(b);
      const a = document.createElement('audio');
      a.src = 'data:audio/wav;base64,' + btoa(bin);
      a.loop = true;
      a.preload = 'auto';
      a.setAttribute('playsinline', '');
      a.setAttribute('x-webkit-airplay', 'deny');
      this.tag = a;
    }
    try {
      if (on) { const pr = this.tag.play(); if (pr) pr.catch(() => {}); } else this.tag.pause();
    } catch (_) { /* 무시 */ }
  }

  // 무음 1샘플 재생: iOS는 사용자 탭 안에서 소리를 한 번 내야 오디오가 확실히 풀린다
  poke() {
    this.silentTag(!this.muted);
    if (!this.ctx) return;
    try {
      const blank = this.ctx.createBufferSource();
      blank.buffer = this.ctx.createBuffer(1, 1, 22050);
      blank.connect(this.ctx.destination);
      blank.start(0);
    } catch (_) { /* 무시 */ }
  }

  // 모바일 오디오 잠금 해제: 화면 어디를 눌러도 깨운다.
  // 다른 앱에 다녀오면 iOS는 오디오가 'interrupted'로 멈추고, resume()해도 소리가 안 나거나
  // 응답이 없는 경우가 있다. 그래서 돌아오면 표시해 두고, 다음 탭에서 오디오를 새로 만든다.
  bindUnlock() {
    if (typeof document === 'undefined') return;
    // 브라우저가 '사용자 동작'으로 인정하는 이벤트에서만 깨운다 (손가락이 닿는 순간인 pointerdown은
    // 안드로이드 크롬이 인정하지 않아, 그때 만든 오디오는 잠긴 채로 남는다)
    const wake = () => this.unlock();
    for (const ev of ['touchend', 'pointerup', 'mouseup', 'click', 'keydown']) {
      document.addEventListener(ev, wake, { capture: true, passive: true });
    }
    const away = () => {
      this.stale = true;
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) away();
      else this.resume();
    });
    window.addEventListener('pagehide', away);
    window.addEventListener('pageshow', () => this.resume());
  }

  // 오디오를 버리고 새로 만든다 (사용자 탭 안에서만 호출)
  rebuild() {
    const old = this.ctx;
    this.ctx = null;
    this.noiseBuf = null;
    this.waking = false;
    if (old && old.state !== 'closed') old.close().catch(() => {});
    this.unlock();
  }

  // 켠 직후 오디오가 실제로 돌기 시작할 때까지 기다림 (최대 0.4초). 판 시작 소리를 놓치지 않게.
  ready() {
    if (!this.ctx || this.muted) return Promise.resolve();
    return Promise.race([this.resume(), new Promise((r) => setTimeout(r, 400))]);
  }

  resume() {
    if (this.muted || !this.ctx) return Promise.resolve();
    if (this.ctx.state === 'closed') { this.ctx = null; return Promise.resolve(); } // 다음 탭에서 새로 만듦
    if (this.ctx.state === 'running') return Promise.resolve();
    return this.ctx.resume().catch(() => {});
  }

  unlock() {
    if (!this.enabled || this.muted) return;
    if (this.ctx) {
      // 다른 앱에 다녀왔거나 멈춘 채 안 풀리면 새로 만든다
      if (this.stale || this.ctx.state === 'closed' || (this.ctx.state !== 'running' && this.ctx.state !== 'suspended')) {
        this.stale = false;
        this.rebuild();
        return;
      }
      this.resume();
      if (this.ctx.state !== 'running') this.poke();
      return;
    }
    this.stale = false;
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
      const ctx = this.ctx;
      // resume()이 끝내 응답하지 않아도(iOS) 소리가 영영 막히지 않게 0.5초 뒤 풀어 준다
      const giveUp = setTimeout(() => { this.waking = false; }, 500);
      this.resume().then(() => {
        clearTimeout(giveUp);
        this.waking = false;
        if (this.ctx === ctx && ctx.state === 'running') this.play(name, semitone);
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

  // 마림바 한 음: 기음 + 4배음(나무 건반의 "통") + 짧은 타격음
  marimba(f, start = 0, vol = 0.24, len = 0.45) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    for (const [m, v, dur] of [[1, 1, len], [3.93, 0.3, 0.12], [9.2, 0.08, 0.04]]) {
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

  // 구슬 똑딱: 아주 짧은 나무 타격음 (멜로디가 들리지 않게 음높이를 무작위로)
  tick(start = 0, vol = 0.3) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const f = 1700 + Math.random() * 900;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.025);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(this.gain);
    o.start(t);
    o.stop(t + 0.05);
    this.noise(0.015, vol * 0.6, 3500 + Math.random() * 1500, start, 'bandpass', 3000, 1.5);
  }

  // 사람 목소리 흉내: 톱니파 성대 + 모음 포먼트(대역 필터 3개). formants: [[주파수, 세기], ...]
  vowel(start, dur, f0, f1, formants, vol = 0.5) {
    const ctx = this.ctx;
    const t = this.t0 + start;
    const o = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vg = ctx.createGain();
    const out = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    vib.frequency.value = 5.5;
    vg.gain.value = f0 * 0.02;
    vib.connect(vg).connect(o.frequency);
    for (const [ff, amp] of formants) {
      const bp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = ff;
      bp.Q.value = ff / 90;
      g.gain.value = amp;
      o.connect(bp).connect(g).connect(out);
    }
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    out.gain.setValueAtTime(vol, t + dur * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    out.connect(this.gain);
    for (const x of [o, vib]) { x.start(t); x.stop(t + dur + 0.03); }
  }

  // ---------- 효과음 ----------

  synth(name, semitone) {
    const k = Math.pow(2, semitone / 12);
    switch (name) {
      case 'match': // 점액질 철퍼덕 (모든 인물 공통)
        this.splat(1);
        break;
      case 'land': // "또르르": 음 없이 구슬 굴러가듯 짧은 나무 똑딱 (높낮이는 살짝만 흔들림)
        this.tick();
        break;
      case 'miss': { // 헛스왑: 실망한 "아~ 오" (높은 "아" → 낮게 처지는 "오")
        const p = 0.95 + Math.random() * 0.1;
        this.vowel(0, 0.2, 290 * p, 300 * p, [[850, 1], [1250, 0.6], [2600, 0.25]], 1.6);
        this.vowel(0.24, 0.42, 225 * p, 175 * p, [[480, 1], [820, 0.55], [2400, 0.15]], 1.6);
        break;
      }
      case 'chain': // 연쇄: 반음씩 올라가는 카주 "뿌-뿌우"
        this.kazoo(392 * k, 0, 0.09, 0.5);
        this.kazoo(523 * k, 0.08, 0.16, 0.55);
        break;
      case 'special_anthem': { // 성조기: 철퍽 뒤에 마림바로 "솔~미 | 도 미 솔 | 도~~" (O say can you see)
        this.splat(0.9);
        // 3/4박자 못갖춘마디, 4분음표 0.5초. 음마다 짧게 끊어 쳐서 박자가 또렷하게.
        const q = 0.5;
        const notes = [
          // [주파수, 길이(박), 세기]
          [784, 0.75, 0.26],  // 솔 (점8분)  O~
          [659, 0.25, 0.22],  // 미 (16분)   say
          [523, 1, 0.34],     // 도 (강박)   can
          [659, 1, 0.26],     // 미          you
          [784, 1, 0.28],     // 솔          see
          [1047, 2, 0.34],    // 도~~ (강박) by
        ];
        let t = 0.35; // 철퍽이 끝난 뒤
        for (const [f, beats, v] of notes) {
          const d = beats * q;
          this.marimba(f, t, v, Math.min(0.9, d * 0.9 + 0.08));
          t += d;
        }
        break;
      }
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
      case 'special_drone': { // 드론 폭탄: "위이이잉~" 프로펠러가 내려오다가 "쾅!"
        const ctx = this.ctx;
        const t = this.t0;
        const o = ctx.createOscillator();
        const am = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(240, t);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.45);
        lfo.frequency.value = 38; // 프로펠러 떨림
        lg.gain.value = 0.4;
        am.gain.value = 0.6;
        lfo.connect(lg).connect(am.gain);
        f.type = 'bandpass';
        f.frequency.value = 900;
        f.Q.value = 1.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(f).connect(am).connect(g).connect(this.gain);
        for (const x of [o, lfo]) { x.start(t); x.stop(t + 0.52); }
        // 쾅
        this.tone('sine', 150, 32, 0.6, 0.9, 0.42);
        this.noise(0.5, 0.75, 1500, 0.42, 'lowpass', 100, 1);
        this.splat(1.3, 0.45);
        break;
      }
      case 'special_dove': { // 비둘기 민병대: "푸드덕" 날갯짓 + "타타타타탕" 연발 + 탄피 "팅"
        for (let i = 0; i < 3; i++) this.noise(0.06, 0.45, 900 + Math.random() * 500, i * 0.07, 'bandpass', 400, 1.2);
        for (let i = 0; i < 6; i++) {
          const st = 0.22 + i * 0.075;
          this.noise(0.05, 0.9, 2500, st, 'lowpass', 300, 0.8);   // 총성
          this.tone('square', 160, 50, 0.05, 0.35, st);           // 반동 저음
        }
        [0.4, 0.55, 0.72].forEach((st) => this.tone('sine', 3400 + Math.random() * 600, 3000, 0.08, 0.08, st)); // 탄피
        break;
      }
      case 'beep': // 시한폭탄 카운트다운 "삑" (semitone 7이면 0초: 더 높게)
        this.tone('square', 1320 * k, 1320 * k, 0.07, 0.16);
        break;
      case 'special_boom': // 그 밖: 철퍼덕 쾅
        this.splat(1.6);
        this.splat(1.2, 0.07);
        this.tone('sine', 140, 32, 0.55, 0.8);
        this.noise(0.45, 0.6, 900, 0, 'lowpass', 120, 1);
        break;
      case 'clear': // 판 클리어: 팡파레 대신 철퍼덕이 와르르 + 기포 뽀글뽀글 + 마지막 대형 철퍼덕
        for (let i = 0; i < 6; i++) this.splat(0.9 + i * 0.08, i * 0.11, i % 4);
        for (let i = 0; i < 14; i++) this.bubble(0.2 + i * 0.04 + Math.random() * 0.03, 300 + Math.random() * 700, 0.03, 0.18);
        this.splat(1.6, 0.8, 0);
        this.thump(0.8, 50, 0.8, 0.3);
        break;
      default:
        break;
    }
  }
}
