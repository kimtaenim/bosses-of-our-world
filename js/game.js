import { Board, makeTile } from './board.js';
import { Tweener, ease, overshoot } from './tween.js';
import { FX } from './fx.js';
import { Sprites } from './sprites.js';
import { targetScore } from '../config.js';
import { loadProgress, saveProgress } from './storage.js';
import { EFFECTS } from './effects.js';
import { Sound } from './audio.js';
import { Faces, PRIO } from './faces.js';

const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Game {
  // data: characters.json 내용 (characters, levels, expressions, expressionFallback)
  constructor(canvas, characters, data, config, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.chars = characters;
    this.levels = data.levels;
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
    this.sprites = new Sprites(characters, this.T, data.expressions, data.expressionFallback, { format: data.faceFormat, scale: data.faceScale });
    this.faces = new Faces(this);
    this.sound = new Sound(config);

    this.board = null;
    this.dying = [];       // 그리드에서 빠졌지만 아직 터지는 중인 타일
    this.busy = false;
    this.selected = null;

    this.level = 1;
    this.score = 0;
    this.shownScore = 0;
    this.lastInput = 0;
    this.hint = null;      // { a, b, t0 }
    this.lastTs = 0;
    this.best = loadProgress().best;
  }

  async init(firstLevel = 1) {
    await this.sprites.load();
    // prefers-reduced-motion: 흔들림·파티클 자동 비활성
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq) {
      this.fx.reduced = mq.matches;
      const onChange = (e) => { this.fx.reduced = e.matches; };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
    requestAnimationFrame((ts) => this.loop(ts));
    this.busy = true;
    await this.startLevel(firstLevel);
    this.busy = false;
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

  // characters.json levels: order 앞에서부터 counts[판-1]명 (counts 끝 이후는 마지막 값 유지)
  levelTypes(level = this.level) {
    const order = (this.levels && this.levels.order) || this.chars.map((ch) => ch.id);
    const counts = (this.levels && this.levels.counts) || [order.length];
    const n = counts[Math.min(level, counts.length) - 1];
    const types = order.slice(0, n)
      .map((id) => this.chars.findIndex((ch) => ch.id === id))
      .filter((i) => i >= 0);
    return types.length >= 3 ? types : this.chars.map((_, i) => i);
  }

  // 새 보드를 만들고 위에서 쏟아져 내려오게 한다
  async startLevel(level) {
    this.level = level;
    this.score = 0;
    this.shownScore = 0;
    this.best = Math.max(this.best, level);
    saveProgress(level, this.best);
    this.board = new Board(this.cfg.COLS, this.cfg.ROWS, this.levelTypes(level));
    this.board.fillInitial();
    this.updateHud();

    const rows = this.cfg.ROWS;
    const falls = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < this.cfg.COLS; c++) {
        falls.push({ tile: this.board.get(r, c), c, fromY: r - rows - 1, toR: r });
      }
    }
    await this.animateFalls(falls, (f) => (rows - 1 - f.toR) * 35 + f.c * 12 + Math.random() * 30);
    this.lastInput = this.tw.time;
    // 착지 후 다 같이 환호 (입력은 막지 않음)
    for (const f of falls) {
      this.tw.after(260 + f.c * 35 + f.toR * 15, () => {
        if (this.faces.set(f.tile, 'cheer', 650, PRIO.REACT)) this.faces.hop(f.tile, 7, 320);
      });
    }
  }

  target() { return targetScore(this.level); }

  // ---------- 입력 ----------

  canInput() { return !this.busy; }

  onUserInput() {
    this.sound.unlock();
    this.lastInput = this.tw.time;
    this.clearHint();
  }

  async requestSwap(a, b) {
    if (this.busy) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
    this.busy = true;
    this.selected = null;
    this.clearHint();
    const board = this.board;
    const ta = board.get(a.r, a.c), tb = board.get(b.r, b.c);
    for (const t of [ta, tb]) {
      this.faces.cancelMotion(t);
      this.faces.set(t, 'nervous', 400, PRIO.REACT);
    }

    board.swap(a, b);
    await this.animateSwap(ta, a, b, tb);
    if (board.findMatches().groups.length === 0) {
      board.swap(a, b);
      await this.animateSwap(ta, b, a, tb);
      // 헛스왑: 둘 다 삐져서 도리도리
      for (const t of [ta, tb]) {
        this.faces.set(t, 'sulk', 900, PRIO.REACT);
        this.faces.headShake(t);
      }
      this.endTurn();
      return;
    }
    await this.resolve([b, a]);
    this.endTurn();
  }

  endTurn() {
    this.busy = false;
    this.lastInput = this.tw.time;
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

  // swapCells: 스왑한 두 칸 (특수 타일 생성 위치 우선순위 순)
  async resolve(swapCells) {
    let cascade = 0;
    for (;;) {
      const m = this.board.findMatches();
      if (m.groups.length === 0) break;
      cascade++;
      await this.resolveStep(m, cascade, cascade === 1 ? swapCells : null);
      if (this.score >= this.target()) {
        await this.levelClear();
        return;
      }
      await this.animateFalls(this.board.collapse());
    }
    // 가능한 수가 없으면 알림 없이 셔플
    if (!this.board.findMove()) await this.shuffleBoard();
  }

  async shuffleBoard() {
    this.board.shuffle();
    const moves = [];
    for (let r = 0; r < this.cfg.ROWS; r++) {
      for (let c = 0; c < this.cfg.COLS; c++) {
        const t = this.board.get(r, c);
        moves.push({ t, x0: t.x, y0: t.y, x1: c, y1: r });
        this.faces.cancelMotion(t);
        this.faces.set(t, 'eyeroll', 650, PRIO.REACT);
      }
    }
    await this.tw.tween(380, (p) => {
      for (const m of moves) {
        m.t.x = m.x0 + (m.x1 - m.x0) * p;
        m.t.y = m.y0 + (m.y1 - m.y0) * p;
      }
    }, ease.inOutQuad);
  }

  // 판 클리어: 보드 전체가 아래에서 위로 순차 터지고, 다음 판 보드가 쏟아져 내려옴
  async levelClear() {
    this.selected = null;
    this.clearHint();
    this.vibrate([30, 50, 30]);
    this.sound.play('clear');
    this.showBanner(`판 ${this.level} 클리어!`);

    const board = this.board;
    const rows = this.cfg.ROWS, cols = this.cfg.COLS;
    let last = 0;
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const t = board.get(r, c);
        if (!t) continue;
        board.cells[board.idx(r, c)] = null;
        this.dying.push(t);
        this.faces.cancelMotion(t);
        this.faces.set(t, 'shock', Infinity, PRIO.DOOM);
        const delay = (rows - 1 - r) * 55 + c * 10;
        last = Math.max(last, delay);
        this.tw.after(delay, () => {
          this.popTile(t, 3, 1.6);
          if (c === 0) this.fx.shake(3 + (rows - 1 - r));
        });
      }
    }
    await this.tw.wait(last + 120 + 450);
    this.dying = [];
    await this.startLevel(this.level + 1);
  }

  showBanner(text) {
    const el = this.hud.banner;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('show');
  }

  // ---------- 힌트 ----------

  clearHint() {
    if (!this.hint) return;
    for (const p of [this.hint.a, this.hint.b]) {
      const t = this.board && this.board.get(p.r, p.c);
      if (t) t.hx = t.hy = 0;
    }
    this.hint = null;
  }

  updateHint() {
    if (this.busy || !this.board) return;
    if (!this.hint) {
      if (this.tw.time - this.lastInput < this.cfg.HINT_DELAY_MS) return;
      const mv = this.board.findMove();
      if (!mv) return;
      this.hint = { a: mv[0], b: mv[1], t0: this.tw.time };
    }
    // 두 타일이 서로를 향해 살짝 흔들림 (0.5초 흔들고 0.8초 쉼)
    const { a, b, t0 } = this.hint;
    const phase = (this.tw.time - t0) % 1300;
    const k = phase < 500 ? Math.sin((phase / 500) * Math.PI * 4) * 3.5 * (1 - phase / 500) : 0;
    const dx = b.c - a.c, dy = b.r - a.r;
    const ta = this.board.get(a.r, a.c), tb = this.board.get(b.r, b.c);
    if (ta) { ta.hx = dx * k; ta.hy = dy * k; }
    if (tb) { tb.hx = -dx * k; tb.hy = -dy * k; }
    // 서로를 쳐다봄 (가로: 곁눈질, 세로: 아래 타일은 눈 치켜뜨고 위 타일은 긴장)
    if (dx !== 0) {
      this.faces.set(ta, 'glance', 150, PRIO.REACT, dx < 0);
      this.faces.set(tb, 'glance', 150, PRIO.REACT, dx > 0);
    } else {
      this.faces.set(ta, 'nervous', 150, PRIO.REACT);
      this.faces.set(tb, 'eyeroll', 150, PRIO.REACT);
    }
  }

  async resolveStep(m, cascade, swapCells) {
    const J = this.J;
    const board = this.board;
    const rows = this.cfg.ROWS, cols = this.cfg.COLS;
    const HIT = J > 0 ? 40 : 0;

    // 1) 4개 이상 매치 그룹 → 특수 타일 생성 위치 (스왑한 칸 우선, 없으면 그룹 중심에 가까운 칸)
    const spawns = [];
    for (const g of m.groups) {
      if (g.cells.length < 4) continue;
      let at = -1;
      if (swapCells) {
        for (const s of swapCells) {
          const i = board.idx(s.r, s.c);
          if (g.cells.includes(i)) { at = i; break; }
        }
      }
      if (at < 0) {
        let sr = 0, sc = 0;
        for (const i of g.cells) { const [r, c] = board.rc(i); sr += r; sc += c; }
        sr /= g.cells.length; sc /= g.cells.length;
        let bestD = Infinity;
        for (const i of g.cells) {
          const [r, c] = board.rc(i);
          const d = (r - sr) ** 2 + (c - sc) ** 2;
          if (d < bestD) { bestD = d; at = i; }
        }
      }
      spawns.push({ idx: at, type: g.type, cells: g.cells });
    }

    // 2) 터지는 시각 스케줄 (특수 타일 연쇄 발동 포함). 시각은 스텝 시작 기준 ms.
    const popAt = new Map();
    const setMin = (i, t) => { if (!popAt.has(i) || popAt.get(i) > t) popAt.set(i, t); };
    const triggers = [];
    const fired = new Set();
    const plays = [];
    for (const i of m.matched) {
      if (board.cells[i].special) triggers.push({ i, t: HIT });
      else popAt.set(i, HIT);
    }
    while (triggers.length) {
      triggers.sort((a, b) => a.t - b.t);
      const { i, t } = triggers.shift();
      if (fired.has(i)) continue;
      fired.add(i);
      const tile = board.cells[i];
      const effect = EFFECTS[this.chars[tile.type].group];
      popAt.set(i, t);
      if (!effect) continue;
      const [r, c] = board.rc(i);
      plays.push({ t, effect, r, c });
      for (const a of effect.area(r, c, rows, cols)) {
        const j = board.idx(a.r, a.c);
        const tt = t + a.delay;
        if (j === i) { popAt.set(i, tt); continue; }
        const other = board.cells[j];
        if (!other) continue;
        if (other.special) { if (!fired.has(j)) triggers.push({ i: j, t: tt }); }
        else setMin(j, tt);
      }
    }

    // 3) 그리드 갱신: 제거 + 특수 타일 배치 (연출은 아래에서 시간차로)
    const removed = [...popAt.entries()].map(([i, t]) => ({ i, t, tile: board.cells[i] }));
    const matchedTiles = [...m.matched].map((i) => board.cells[i]);
    const doomed = new Map(removed.map((e) => [e.i, e.tile]));
    for (const e of removed) board.cells[e.i] = null;
    this.dying.push(...removed.map((e) => e.tile));
    for (const sp of spawns) {
      const [r, c] = board.rc(sp.idx);
      sp.tile = makeTile(sp.type, true, r, c);
      sp.tile.scale = 0;
      board.cells[sp.idx] = sp.tile;
    }

    // 4) 히트스톱: 매치된 타일만 40ms 정지, 1.15배로 부풀며 좌우 2px 떨림 (표정: 깜짝 놀람)
    for (const t of matchedTiles) {
      this.faces.cancelMotion(t);
      this.faces.set(t, 'shock', Infinity, PRIO.DOOM);
    }
    if (HIT > 0) {
      await this.tw.tween(HIT, (p) => {
        for (const t of matchedTiles) {
          t.scale = 1 + 0.15 * J * Math.min(1, p * 2);
          t.jx = (Math.random() < 0.5 ? -2 : 2) * J;
        }
      });
      for (const t of matchedTiles) t.jx = 0;
    }

    this.stepFeedback([...m.matched], cascade);

    // 5) 터짐 / 특수 발동 / 특수 생성 연출
    let end = 0;
    for (const e of removed) {
      const d = e.t - HIT;
      end = Math.max(end, d + 120);
      const [pr, pc] = board.rc(e.i);
      this.tw.after(d, () => {
        this.popTile(e.tile, e.tile.special ? 2 : 1);
        this.reactAround(pr, pc);
      });
    }
    for (const pl of plays) {
      this.tw.after(pl.t - HIT, () => {
        pl.effect.play(this, pl.r, pl.c, rows, cols);
        this.reactToSpecial(pl, doomed);
        this.fx.shake(8);
        this.vibrate(30);
        this.sound.play('special');
      });
    }
    for (const sp of spawns) {
      end = Math.max(end, 100 + 150);
      this.spawnSpecial(sp);
    }
    await this.tw.wait(end);

    this.addScore(removed.length, cascade);
    const gone = new Set(removed.map((e) => e.tile));
    this.dying = this.dying.filter((t) => !gone.has(t));
  }

  // 주변 타일 파편이 생성 위치로 빨려 들어온(100ms) 뒤 특수 타일이 팝(1.3배 → 1배)
  spawnSpecial(sp) {
    const board = this.board;
    const [r, c] = board.rc(sp.idx);
    const x = this.cx(c), y = this.cy(r);
    const color = this.chars[sp.type].color;
    for (const i of sp.cells) {
      if (i === sp.idx) continue;
      const [rr, cc] = board.rc(i);
      this.fx.suck(this.cx(cc), this.cy(rr), x, y, color, 5, 100);
    }
    const t = sp.tile;
    this.tw.after(100, () => {
      const J = this.J;
      this.fx.ring(x, y, this.T * 0.2, this.T * 0.8, 150, 3, '255,230,120');
      if (J <= 0) { t.scale = 1; return; }
      this.tw.tween(150, (p) => { t.scale = 1 + 0.3 * J * (1 - p); }, ease.outQuad);
    });
  }

  stepFeedback(cells, cascade) {
    this.vibrate(10);
    this.sound.play('match');
    if (cascade >= 2) {
      this.sound.play('chain', cascade - 2);
      let sx = 0, sy = 0;
      for (const i of cells) { const [r, c] = this.board.rc(i); sx += this.cx(c); sy += this.cy(r); }
      this.fx.text(sx / cells.length, sy / cells.length, `x${cascade}`, cascade);
    }
    if (cascade >= 3) {
      this.fx.shake(Math.min(2 * (cascade - 2), 10));
      // 큰 연쇄: 보드 여기저기서 깜짝 놀라 펄쩍
      for (const t of this.board.cells) {
        if (t && Math.random() < 0.45 && this.faces.set(t, 'shock', 380, PRIO.REACT)) this.faces.hop(t, 4 + cascade, 260);
      }
    }
  }

  addScore(count, cascade) {
    this.score += Math.floor(count * 10 * Math.pow(1.5, cascade - 1));
    this.updateHud();
  }

  // 터진 칸 주변 8칸: 폭발 쪽을 쳐다보며 움찔
  reactAround(r, c) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr || dc) this.faces.flinch(this.board.get(r + dr, c + dc), c, r);
      }
    }
  }

  // 특수 발동: 영향 범위 안의 타일은 공포, 가까운 타일은 크게 움찔, 나머지는 쳐다봄
  // doomed: 이번 스텝에 터질 타일 (idx → tile, 이미 그리드에서 빠져 있음)
  reactToSpecial(pl, doomed) {
    const board = this.board;
    const area = new Set(pl.effect.area(pl.r, pl.c, this.cfg.ROWS, this.cfg.COLS).map((a) => board.idx(a.r, a.c)));
    for (const i of area) {
      const t = doomed.get(i);
      if (t && t.expr !== 'scream') this.faces.set(t, 'shock', Infinity, PRIO.DOOM);
    }
    for (let r = 0; r < this.cfg.ROWS; r++) {
      for (let c = 0; c < this.cfg.COLS; c++) {
        const t = board.get(r, c);
        if (!t || area.has(board.idx(r, c))) continue;
        if (Math.max(Math.abs(r - pl.r), Math.abs(c - pl.c)) <= 2) this.faces.flinch(t, pl.c, pl.r, true);
        else this.faces.lookAt(t, pl.c, pl.r, 700);
      }
    }
  }

  // 터짐: 120ms 동안 1.4배로 커지며 페이드아웃 + 파편 + 흰 링
  popTile(t, particleMul = 1, speed = 1) {
    const J = this.J;
    this.faces.set(t, 'scream', Infinity, PRIO.DOOM);
    const x = this.cx(t.x), y = this.cy(t.y);
    this.fx.burst(x, y, this.chars[t.type].color, randInt(8, 12) * particleMul, speed);
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
      this.faces.cancelMotion(t);
      this.faces.set(t, 'fall', Infinity, PRIO.MOVE);
      const dur = Math.sqrt((2 * d) / g);
      const delay = delayFn ? delayFn(f) : 0;
      return this.tw.tween(dur, (p) => { t.y = f.fromY + d * p * p; }, ease.linear, delay)
        .then(() => this.land(t));
    }));
  }

  land(t) {
    t.y = Math.round(t.y);
    this.faces.set(t, 'squish', 230, PRIO.MOVE);
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
    const target = this.target();
    this.hud.level.textContent = this.level;
    this.hud.target.textContent = target.toLocaleString();
    this.hud.best.textContent = this.best;
    this.hud.bar.style.width = `${Math.min(100, (this.score / target) * 100)}%`;
    this.renderScore();
  }

  renderScore() {
    this.hud.score.textContent = Math.round(this.shownScore).toLocaleString();
  }

  // 표시 점수를 실제 점수로 빠르게 따라가게
  updateScoreDisplay(dt) {
    if (this.shownScore === this.score) return;
    const diff = this.score - this.shownScore;
    const step = Math.max(1, Math.abs(diff) * (1 - Math.exp(-dt / 70)));
    this.shownScore = Math.abs(diff) <= step ? this.score : this.shownScore + Math.sign(diff) * step;
    this.renderScore();
  }

  // ---------- 루프·렌더 ----------

  loop(ts) {
    const dt = this.lastTs ? Math.min(ts - this.lastTs, 50) : 16;
    this.lastTs = ts;
    this.tw.update(dt);
    this.fx.update(dt);
    this.faces.update();
    this.updateHint();
    this.updateScoreDisplay(dt);
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
    const sel = this.selected && this.board && this.board.get(this.selected.r, this.selected.c);
    if (this.board) for (const t of this.board.cells) if (t) this.drawTile(t, t === sel, ts);
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

  drawTile(t, selected = false, ts = 0) {
    if (t.alpha <= 0 || t.scale <= 0) return;
    // 집힌 타일은 긴장해서 달달 떪
    const spr = this.sprites.get(t, selected && !t.special ? 'nervous' : t.expr, selected ? false : t.flip);
    if (!spr) return;
    const ctx = this.ctx;
    const T = this.T;
    const amp = this.faces.amp;
    let ox = t.jx + (t.hx || 0) + t.ox;
    let oy = (t.hy || 0) + t.oy;
    if (selected) ox += (Math.random() * 2 - 1) * 0.9 * amp;
    // 평소 숨쉬듯 살짝 들썩
    if (t.exprPrio === 0) oy += Math.sin(ts / 520 + t.phase) * 0.8 * amp * this.faces.activity;
    ctx.globalAlpha = t.alpha;
    ctx.save();
    ctx.translate(this.cx(t.x) + ox, this.cy(t.y) + oy);
    if (t.rot) ctx.rotate(t.rot);
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
