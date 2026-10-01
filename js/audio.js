// 사운드 4종(match / special / clear / chain).
// assets/sounds/에 파일이 있으면 그 파일을, 없으면 Web Audio로 합성한 효과음을 쓴다.
// 합성음은 풍자 톤: 터질 때 질척한 "철퍽" + 인물별 한마디
//   정치인 → 거창하게 시작했다가 김빠지는 국가원수 팡파레
//   머스크 → 빵빵 경적, 베조스 → 돈통 "카칭", 저커버그 → 좋아요 알림, 알트만 → 로봇 삑삑
// chain은 연쇄 단계마다 반음씩 올라가는 카주(semitone 인자).

const MUTE_KEY = 'bosses-of-our-world.muted';

// 같은 이름 소리의 최소 간격(ms). 특수 타일 여러 개가 동시에 터져도 귀가 찢어지지 않게.
const MIN_GAP = { match: 45, special: 90, bomb: 140, voice: 160, chain: 40, clear: 300 };

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

  // voice: 터진 인물 { id, group } (합성음에서 인물별 한마디)
  play(name, semitone = 0, voice = null) {
    if (!this.enabled || this.muted || !this.ctx) return;
    // 오디오가 잠들어 있으면 깨운 뒤에 재생 (소리를 버리지 않음)
    if (this.ctx.state !== 'running') {
      if (this.waking) return;
      this.waking = true;
      this.resume().then(() => {
        this.waking = false;
        if (this.ctx && this.ctx.state === 'running') this.play(name, semitone, voice);
      });
      return;
    }
    const now = performance.now();
    if (now - (this.last[name] || 0) < (MIN_GAP[name] || 0)) return;
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
    if (voice && this.synthOn && (name === 'match' || name === 'special')) {
      if (now - (this.last.voice || 0) < MIN_GAP.voice) return;
      this.last.voice = now;
      try { this.voice(voice, name === 'special'); } catch (_) { /* 무시 */ }
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

  // 질척한 "철퍽": 출렁이는 저음 + 아래로 훑는 젖은 노이즈
  splat(size = 1, delay = 0) {
    const ctx = this.ctx;
    const t = this.t0 + delay;
    const p = 0.85 + Math.random() * 0.35;
    const dur = 0.16 + 0.12 * size;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(380 * p, t);
    o.frequency.exponentialRampToValueAtTime(55 * p, t + dur);
    lfo.frequency.value = 22 + Math.random() * 10; // 출렁출렁
    lg.gain.value = 70 * p;
    lfo.connect(lg).connect(o.frequency);
    this.env(g, t, 0.8 * Math.min(size, 1.6), 0.004, dur);
    o.connect(g).connect(this.gain);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
    this.noise(dur * 0.9, 0.75 * Math.min(size, 1.6), 2600 * p, delay, 'lowpass', 160, 4);
    // 끈적하게 떨어지는 물방울 "똑"
    this.tone('sine', 900 * p, 1500 * p, 0.05, 0.12, delay + dur * 0.8);
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

  // ---------- 효과음 ----------

  synth(name, semitone) {
    const k = Math.pow(2, semitone / 12);
    switch (name) {
      case 'match': // 철퍽
        this.splat(1);
        break;
      case 'chain': // 연쇄: 반음씩 올라가는 카주 "뿌-뿌우"
        this.kazoo(392 * k, 0, 0.09, 0.5);
        this.kazoo(523 * k, 0.08, 0.16, 0.55);
        break;
      case 'bomb': // 3×3 폭탄: 방귀 "뿌우우웅~뿡" + 질척
        this.fart(1);
        this.splat(1.2, 0.02);
        break;
      case 'special': // 철퍼덕 쾅: 큰 질척임 + 저음 쿵
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

  // 인물별 한마디. big이면 특수 타일 (더 길고 거창하게)
  voice(v, big) {
    const id = v.id;
    const r = 0.97 + Math.random() * 0.06;
    if (v.group === 'politician') {
      // 국가원수 팡파레 "빠바바밤~" 하다가 마지막 음이 김빠지듯 축 처짐
      const key = { trump: 1, kim: 0.94, putin: 0.84, mbs: 1.06 }[id] || 1;
      const b = 392 * key * r;
      if (big) {
        [[1, 0, 0.1], [1, 0.11, 0.1], [1, 0.22, 0.1], [4 / 3, 0.33, 0.22], [5 / 3, 0.56, 0.5]]
          .forEach(([m, s, d], i, a) => this.brass(b * m, s, d, 0.2, i === a.length - 1 ? -5 : 0));
        this.noise(0.18, 0.25, 220, 0.33, 'lowpass', 120, 1); // 팀파니 쿵
      } else {
        this.brass(b, 0.02, 0.08, 0.16);
        this.brass(b * 4 / 3, 0.11, 0.08, 0.16);
        this.brass(b * 5 / 3, 0.2, 0.34, 0.17, -4);
      }
      return;
    }
    switch (id) {
      case 'musk': // 빵빵 (두 음 경적)
        for (let i = 0; i < (big ? 3 : 2); i++) {
          this.brass(415 * r, i * 0.13, 0.1, 0.12);
          this.brass(523 * r, i * 0.13, 0.1, 0.1);
        }
        break;
      case 'bezos': // 카칭!
        this.noise(0.04, 0.4, 3000, 0.02, 'bandpass', 3000, 2);
        this.tone('triangle', 2637 * r, 2637 * r, 0.35, 0.28, 0.06);
        this.tone('triangle', 3520 * r, 3520 * r, 0.45, 0.2, 0.1);
        if (big) [0.25, 0.32, 0.4, 0.47].forEach((s) => this.tone('sine', 4186 * (0.9 + Math.random() * 0.2), 4186, 0.08, 0.08, s));
        break;
      case 'zuck': // 좋아요 알림 "띠링"
        this.tone('sine', 1047 * r, 1047 * r, 0.12, 0.3, 0.02);
        this.tone('sine', 1568 * r, 1568 * r, 0.25, 0.27, 0.1);
        if (big) this.tone('sine', 2093 * r, 2093 * r, 0.3, 0.14, 0.2);
        break;
      case 'altman': // 로봇 삑삑
        for (let i = 0; i < (big ? 6 : 3); i++) {
          const f = [880, 1320, 660, 1760, 990, 1480][i] * r;
          this.tone('square', f, f, 0.05, 0.2, 0.02 + i * 0.06);
        }
        break;
      default:
        break;
    }
  }
}
