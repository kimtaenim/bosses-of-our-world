// 사운드 슬롯 4종(match / special / clear / chain). 기본 무음(CONFIG.SOUND_ENABLED = false).
// chain은 연쇄 단계마다 반음씩 피치를 올릴 수 있도록 semitone 인자를 받는다.

export class Sound {
  constructor(cfg) {
    this.enabled = !!cfg.SOUND_ENABLED;
    this.files = cfg.SOUNDS || {};
    this.volume = cfg.SOUND_VOLUME ?? 0.8;
    this.ctx = null;
    this.buffers = {};
  }

  // 첫 사용자 입력 때 호출 (모바일 오디오 잠금 해제)
  unlock() {
    if (!this.enabled || this.ctx) return;
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
        .catch(() => { /* 파일 없으면 그 슬롯은 무음 */ });
    }
  }

  play(name, semitone = 0) {
    if (!this.enabled || !this.ctx) return;
    const buf = this.buffers[name];
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, semitone / 12);
    src.connect(this.gain);
    src.start();
  }
}
