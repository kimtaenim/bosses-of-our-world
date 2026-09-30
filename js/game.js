import { Board } from './board.js';
import { Tweener, ease, overshoot } from './tween.js';
import { FX } from './fx.js';
import { Sprites } from './sprites.js';

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Game {
  constructor(canvas, characters, config, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.chars = characters;
    this.cfg = config;
    this.hud = hud;

    this.J = Math.max(0, config.JUICE);
    this.T = config.TILE;
    this.STEP = config.TILE + config.GAP;
    this.M = (config.BASE_WIDTH - (config.COLS * this.STEP - config.GAP)) / 2;
    this.BW = config.BASE_WIDTH;
    this.BH = this.M * 2 + config.ROWS * this.STEP - config.GAP;

    this.tw = new Tweener();
    this.fx = new FX(this.J);
    this.sprites = new Sprites(characters, this.T);

    this.board = null;
    this.dying = [];       // 그리드에서 빠졌지만 아직 터지는 중인 타일
    this.busy = false;
    this.selected = null;

    this.score = 0;
    this.lastTs = 0;
  }

  async init() {
    await this.sprites.load();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.startLevel();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  // ---------- 레이아웃 ----------

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.cw = rect.width;
    this.ch = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    const pad = 8;
    this.scale = Math.min(rect.width / this.BW, (rect.height - pad * 2) / this.BH);
    this.ox = (rect.width - this.BW * this.scale) / 2;
    this.oy = Math.max(pad, (rect.height - this.BH * this.scale) / 2);
    this.sprites.build(this.scale * dpr);
  }

  cx(x) { return this.M + x * this.STEP + this.T / 2; }
  cy(y) { return this.M + y * this.STEP + this.T / 2; }

  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - this.ox) / this.scale - this.M;
    const y = (clientY - rect.top - this.oy) / this.scale - this.M;
    const c = Math.floor((x + this.cfg.GAP / 2) / this.STEP);
    const r = Math.floor((y + this.cfg.GAP / 2) / this.STEP);
    if (!this.board || !this.board.inBounds(r, c)) return null;
    return { r, c };
  }

  // ---------- 판 ----------

  levelTypes() {
    const ids = ['trump', 'kim', 'musk', 'bezos'];
    return ids.map((id) => this.chars.findIndex((ch) => ch.id === id));
  }

  startLevel() {
    this.score = 0;
    this.board = new Board(this.cfg.COLS, this.cfg.ROWS, this.levelTypes());
    this.board.fillInitial();
    this.updateHud();
  }

  // ---------- 입력 ----------

  canInput() { return !this.busy; }

  onUserInput() { this.lastInput = this.tw.time; }

  async requestSwap(a, b) {
    if (this.busy) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
    this.busy = true;
    this.selected = null;
    const board = this.board;
    const ta = board.get(a.r, a.c), tb = board.get(b.r, b.c);

    board.swap(a, b);
    await this.animateSwap(ta, a, b, tb);
    if (board.findMatches().groups.length === 0) {
      board.swap(a, b);
      await this.animateSwap(ta, b, a, tb);
      this.busy = false;
      return;
    }
    await this.resolve();
    this.busy = false;
  }

  // ta: from → to, tb: to → from
  animateSwap(ta, from, to, tb) {
    const o = 0.05 * this.J;
    return this.tw.tween(150, (p) => {
      ta.x = from.c + (to.c - from.c) * p;
      ta.y = from.r + (to.r - from.r) * p;
      tb.x = to.c + (from.c - to.c) * p;
      tb.y = to.r + (from.r - to.r) * p;
    }, overshoot(o));
  }

  // ---------- 매치 해결 루프 ----------

  async resolve() {
    let cascade = 0;
    for (;;) {
      const m = this.board.findMatches();
      if (m.groups.length === 0) break;
      cascade++;
      await this.resolveStep(m, cascade);
      await this.animateFalls(this.board.collapse());
    }
  }

  async resolveStep(m, cascade) {
    const J = this.J;
    const board = this.board;
    const cells = [...m.matched];
    const tiles = cells.map((i) => board.cells[i]);
    for (const i of cells) board.cells[i] = null;
    this.dying.push(...tiles);

    // 히트스톱: 매치된 타일만 40ms 정지, 1.15배로 부풀며 좌우 2px 떨림
    if (J > 0) {
      await this.tw.tween(40, (p) => {
        for (const t of tiles) {
          t.scale = 1 + 0.15 * J * Math.min(1, p * 2);
          t.jx = (Math.random() < 0.5 ? -2 : 2) * J;
        }
      });
      for (const t of tiles) t.jx = 0;
    }

    this.stepFeedback(cells, cascade);
    await Promise.all(tiles.map((t) => this.popTile(t)));

    this.addScore(tiles.length, cascade);
    this.dying = this.dying.filter((t) => !tiles.includes(t));
  }

  stepFeedback(cells, cascade) {
    this.vibrate(10);
    if (cascade >= 2) {
      let sx = 0, sy = 0;
      for (const i of cells) { const [r, c] = this.board.rc(i); sx += this.cx(c); sy += this.cy(r); }
      this.fx.text(sx / cells.length, sy / cells.length, `x${cascade}`, cascade);
    }
    if (cascade >= 3) this.fx.shake(Math.min(2 * (cascade - 2), 10));
  }

  addScore(count, cascade) {
    this.score += Math.floor(count * 10 * Math.pow(1.5, cascade - 1));
    this.updateHud();
  }

  // 터짐: 120ms 동안 1.4배로 커지며 페이드아웃 + 파편 + 흰 링
  popTile(t, particleMul = 1) {
    const J = this.J;
    const x = this.cx(t.x), y = this.cy(t.y);
    this.fx.burst(x, y, this.chars[t.type].color, randInt(8, 12) * particleMul);
    this.fx.ring(x, y, this.T * 0.25, this.T, 150);
    if (J <= 0) { t.alpha = 0; return Promise.resolve(); }
    const s0 = t.scale, s1 = 1 + 0.4 * J;
    return this.tw.tween(120, (p) => {
      t.scale = s0 + (s1 - s0) * p;
      t.alpha = 1 - p;
    }, ease.outQuad);
  }

  // 등가속 낙하 + 착지 스쿼시 + 먼지
  animateFalls(falls, delayFn = null) {
    const g = this.cfg.FALL_GRAVITY / 1e6; // 칸/ms²
    return Promise.all(falls.map((f) => {
      const t = f.tile;
      const d = f.toR - f.fromY;
      t.x = f.c;
      t.y = f.fromY;
      const dur = Math.sqrt((2 * d) / g);
      const delay = delayFn ? delayFn(f) : 0;
      return this.tw.tween(dur, (p) => { t.y = f.fromY + d * p * p; }, ease.linear, delay)
        .then(() => this.land(t));
    }));
  }

  land(t) {
    t.y = Math.round(t.y);
    this.fx.dust(this.cx(t.x), this.cy(t.y) + this.T / 2 - 2);
    const A = 0.15 * this.J;
    if (A <= 0) return;
    this.tw.tween(180, (p) => {
      const f = p < 0.2 ? p / 0.2 : Math.exp(-6 * (p - 0.2)) * Math.cos((p - 0.2) * Math.PI * 3);
      t.sy = 1 - A * f;
      t.sx = 1 + A * 0.5 * f;
    }).then(() => { t.sx = t.sy = 1; });
  }

  vibrate(pattern) {
    if (this.J <= 0) return;
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (_) { /* 무시 */ } }
  }

  // ---------- HUD ----------

  updateHud() {
    this.hud.score.textContent = this.score.toLocaleString();
  }

  // ---------- 루프·렌더 ----------

  loop(ts) {
    const dt = this.lastTs ? Math.min(ts - this.lastTs, 50) : 16;
    this.lastTs = ts;
    this.tw.update(dt);
    this.fx.update(dt);
    this.render(ts);
    requestAnimationFrame((t) => this.loop(t));
  }

  render(ts) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = this.scale * this.dpr;
    ctx.setTransform(k, 0, 0, k,
      (this.ox + this.fx.shakeX * this.scale) * this.dpr,
      (this.oy + this.fx.shakeY * this.scale) * this.dpr);

    // 보드 배경 + 칸
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this.roundRect(0, 0, this.BW, this.BH, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let r = 0; r < this.cfg.ROWS; r++) {
      for (let c = 0; c < this.cfg.COLS; c++) {
        this.roundRect(this.M + c * this.STEP, this.M + r * this.STEP, this.T, this.T, 10);
        ctx.fill();
      }
    }

    // 타일 (보드 영역으로 클립: 위에서 떨어지는 새 타일은 보드 안에서만 보임)
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, 0, this.BW + 40, this.BH + 40);
    ctx.clip();
    if (this.board) for (const t of this.board.cells) if (t) this.drawTile(t);
    ctx.restore();
    for (const t of this.dying) this.drawTile(t);

    // 선택 표시
    if (this.selected) {
      const { r, c } = this.selected;
      const pulse = 1 + 0.04 * Math.sin(ts / 120);
      const s = this.T * pulse;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 3;
      this.roundRect(this.cx(c) - s / 2, this.cy(r) - s / 2, s, s, 12);
      ctx.stroke();
    }

    this.fx.draw(ctx);
  }

  drawTile(t) {
    if (t.alpha <= 0 || t.scale <= 0) return;
    const spr = this.sprites.get(t);
    if (!spr) return;
    const ctx = this.ctx;
    const T = this.T;
    ctx.globalAlpha = t.alpha;
    ctx.save();
    ctx.translate(this.cx(t.x) + t.jx + (t.hx || 0), this.cy(t.y) + (t.hy || 0));
    ctx.scale(t.scale, t.scale);
    ctx.translate(0, T / 2);
    ctx.scale(t.sx, t.sy);
    ctx.drawImage(spr, -T / 2, -T, T, T);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  roundRect(x, y, w, h, r) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
