import { Board, makeTile } from './board.js';
import { Tweener, ease, overshoot } from './tween.js';
import { FX } from './fx.js';
import { Sprites } from './sprites.js';
import { targetScore } from '../config.js';
import { loadProgress, saveProgress } from './storage.js';
import { EFFECTS } from './effects.js';
import { FUSE_MS, SHAKE_MS, FUSE_FROM, KAIJU_FRAMES } from './items.js';
import { Sound } from './audio.js';
import { Faces, PRIO } from './faces.js';

const CHAIN_DELAY = 110; // 연쇄 발동 전 부르르 떠는 시간(ms)
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 판별 인물 수. levels.steps: [{ from: 판, count: 수 }, ...] (from 오름차순)
// 예전 형식 levels.counts: [판1, 판2, ...] (마지막 값 유지)도 지원
export function typeCount(levels, level, max) {
  if (levels && Array.isArray(levels.steps) && levels.steps.length) {
    let n = levels.steps[0].count;
    for (const st of levels.steps) if (level >= st.from) n = st.count;
    return Math.min(n, max);
  }
  const counts = (levels && levels.counts) || [max];
  return Math.min(counts[Math.min(level, counts.length) - 1], max);
}

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
    this.sprites = new Sprites(characters, this.T, data.expressions, data.expressionFallback, { format: data.faceFormat, scale: data.faceScale, shape: config.TILE_SHAPE });
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
    this.spot = null;      // 오래 못 맞출 때 표시: { a, b, cells, from, to, t0 }
    this.deferredKaiju = []; // 폭발에 휘말려, 판이 다시 채워진 뒤 나타날 카이주 [{ r, c }]
    this.pendingItems = []; // 다음에 위에서 떨어질 아이템 ('nuke' | 'timebomb' | 'missile' | 'drone' | 'tariff' | 'ufo' | 'kaiju' | 'secrets')
    this.lastMatch = 0;
    this.lastTs = 0;
    const saved = loadProgress();
    this.best = saved.best;
    this.total = saved.total; // 전체 점수 (모든 판 합계, 처음부터 다시 하면 0)
    this.high = Math.max(saved.high, saved.total); // 하이스코어: 전체 점수 최고 기록
    this.levelT0 = 0; // 이 판 시작 시각 (게임 시계, 앱이 꺼져 있는 동안은 안 흐름)
    this.lastSaveSec = -1;
  }

  // firstLevel을 주지 않으면 저장된 판·점수에서 이어한다
  async init(firstLevel = null) {
    await this.sprites.load();
    // 카이주 걷기 그림 (없으면 코드 그림으로 걸음)
    Promise.all(KAIJU_FRAMES.map((src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; })))
      .then((frames) => { if (frames.every(Boolean)) this.fx.kaijuFrames = frames; });
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
    if (firstLevel) {
      await this.startLevel(firstLevel);
    } else {
      const saved = loadProgress();
      await this.startLevel(saved.reached, Math.min(saved.score, targetScore(saved.reached) - 1), saved.elapsed);
    }
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
  // levels.rotateFrom 판부터는 order 전체에서 무작위로 n명 (교대 출연)
  levelTypes(level = this.level) {
    const order = (this.levels && this.levels.order) || this.chars.map((ch) => ch.id);
    const n = typeCount(this.levels, level, order.length);
    const rotateFrom = this.levels && this.levels.rotateFrom;
    let ids = order.slice(0, n);
    if (rotateFrom && level >= rotateFrom && order.length > n) {
      const pool = [...order];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      ids = pool.slice(0, n);
    }
    const types = ids
      .map((id) => this.chars.findIndex((ch) => ch.id === id))
      .filter((i) => i >= 0);
    return types.length >= 3 ? types : this.chars.map((ch, i) => (ch.item ? -1 : i)).filter((i) => i >= 0);
  }

  // 새 보드를 만들고 위에서 쏟아져 내려오게 한다
  // score: 이어하기일 때 그 판에서 이미 모은 점수
  async startLevel(level, score = 0, elapsed = 0) {
    this.level = level;
    this.pendingItems = [];
    this.deferredKaiju = [];
    this.fullShuffle = false;
    this.levelT0 = this.tw.time - elapsed;
    this.spot = null;
    this.score = score;
    this.shownScore = score;
    this.best = Math.max(this.best, level);
    this.save();
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
    this.lastInput = this.lastMatch = this.tw.time;
    // 착지 후 다 같이 환호 (입력은 막지 않음)
    for (const f of falls) {
      this.tw.after(260 + f.c * 35 + f.toR * 15, () => {
        if (this.faces.set(f.tile, 'cheer', 650, PRIO.REACT)) this.faces.hop(f.tile, 7, 320);
      });
    }
  }

  target() { return targetScore(this.level); }

  save() {
    saveProgress({
      reached: this.level, best: this.best, score: this.score,
      total: this.total, high: this.high, elapsed: this.elapsed(),
    });
  }

  // 타임 보너스 남은 초 표시 (바뀔 때만), 1초마다 경과 시간 저장
  updateTimer() {
    if (!this.board) return;
    const left = this.bonusLeft();
    if (left !== this.shownLeft && this.hud.timer) {
      this.shownLeft = left;
      // 시간 제한이 아니라 '지금 깨면 받는 보너스 점수'로 보여준다
      this.hud.timer.textContent = left > 0 ? `보너스 +${(left * this.bonusPerSec()).toLocaleString()}` : '';
      this.hud.timer.classList.toggle('low', left > 0 && left <= 10);
    }
    const sec = Math.floor(this.elapsed() / 1000);
    if (sec !== this.lastSaveSec) { this.lastSaveSec = sec; this.save(); }
  }

  elapsed() { return Math.max(0, this.tw.time - this.levelT0); }

  // 타임 보너스로 받을 수 있는 남은 초
  bonusLeft() {
    return Math.max(0, Math.ceil(this.bonusSec() - this.elapsed() / 1000));
  }

  bonusPerSec() { return this.cfg.TIME_BONUS_PER_SEC || 10; }

  // 이 판의 보너스 시간(초): 인물 수가 늘면, 판이 올라가면 길어짐
  bonusSec() {
    const tb = this.cfg.TIME_BONUS_SEC;
    if (typeof tb === 'number') return tb + (this.cfg.TIME_BONUS_SEC_STEP || 0) * (this.level - 1);
    const n = this.board ? this.board.types.length : 4;
    let sec = 60;
    for (const k of Object.keys(tb).map(Number).sort((a, b) => a - b)) if (n >= k) sec = tb[k];
    // 판이 올라갈수록 보너스 시간을 더 줌
    return sec + (this.cfg.TIME_BONUS_SEC_STEP || 0) * (this.level - 1);
  }

  addTotal(pts) {
    this.total += pts;
    if (this.total > this.high) this.high = this.total;
  }

  // 1판부터 다시 (전체 점수는 0으로, 하이스코어와 최고 판은 유지)
  async restart() {
    if (this.busy || !this.board) return;
    this.busy = true;
    this.busySince = this.tw.time;
    this.selected = null;
    this.clearHint();
    this.total = 0;
    try {
      await this.startLevel(1);
    } finally {
      this.endTurn();
    }
  }

  // ---------- 입력 ----------

  canInput() { return !this.busy; }

  onUserInput() {
    // 오디오 잠금 해제는 Sound가 손가락을 뗄 때(touchend/click) 직접 처리한다
    this.lastInput = this.tw.time;
    this.clearHint();
  }

  async requestSwap(a, b) {
    if (this.busy) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
    this.busy = true;
    this.busySince = this.tw.time;
    this.selected = null;
    this.clearHint();
    try {
      await this.playSwap(a, b);
    } catch (err) {
      console.error(err);
      this.repairBoard();
    } finally {
      this.endTurn();
    }
  }

  // 특수 타일을 탭하면 그 자리에서 바로 발동
  // force: 시한폭탄은 시간이 됐을 때만 (눌러서는 안 터짐)
  async detonate(cell, force = false) {
    if (this.busy || !this.board) return;
    const t = this.board.get(cell.r, cell.c);
    if (!t || !t.special) return;
    if (t.item === 'timebomb' && !force) return;
    this.busy = true;
    this.busySince = this.tw.time;
    this.selected = null;
    this.clearHint();
    this.spot = null;
    this.lastMatch = this.tw.time;
    try {
      if (t.item === 'tariff') {
        // 관세: 터지지 않고 주변 3×3을 뒤섞음
        await this.tariffShuffle(cell);
        await this.animateFalls(this.collapse());
        await this.resolve(null); // 섞여서 생긴 매치 처리
        return;
      }
      const i = this.board.idx(cell.r, cell.c);
      await this.resolveStep({ groups: [{ type: t.type, cells: [i] }], matched: new Set([i]) }, 1, null);
      if (this.score >= this.target()) {
        await this.levelClear();
      } else {
        await this.animateFalls(this.collapse());
        await this.resolve(null); // 떨어진 뒤 생긴 연쇄 처리 (+ 둘 곳 없으면 셔플)
      }
    } catch (err) {
      console.error(err);
      this.repairBoard();
    } finally {
      this.endTurn();
    }
  }

  // 관세: 관세 타일은 사라지고, 주변 3×3 타일들이 가운데로 빨려 들었다가 빙글 돌며 자리를 바꿈
  async tariffShuffle(cell) {
    const board = this.board;
    const { r, c } = cell;
    const tile = board.get(r, c);
    board.cells[board.idx(r, c)] = null;
    this.sound.special(this.chars[tile.type]); // 리셔플 소리 + 카칭
    this.vibrate(20);
    this.fx.burst(this.cx(c), this.cy(r), '#4E9A4B', 18, 1.3);
    this.fx.ring(this.cx(c), this.cy(r), 6, this.STEP * 1.6, 260, 8, '120,220,120');
    this.popTile(tile, 1);
    const spots = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if ((dr || dc) && board.inBounds(rr, cc) && board.get(rr, cc)) spots.push({ r: rr, c: cc });
      }
    }
    const tiles = spots.map((p) => board.get(p.r, p.c));
    // 자리 섞기 (가능하면 모두 다른 자리로)
    const order = tiles.map((_, i) => i);
    for (let k = 0; k < 20; k++) {
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      if (order.every((o, i) => o !== i) || order.length < 2) break;
    }
    spots.forEach((p, i) => { board.cells[board.idx(p.r, p.c)] = tiles[order[i]]; });
    for (const t of tiles) { this.faces.cancelMotion(t); this.faces.set(t, 'shock', 900, PRIO.MOVE); }
    const J = Math.min(this.J, 1.5);
    const moves = spots.map((p, i) => ({ t: tiles[order[i]], x0: tiles[order[i]].x, y0: tiles[order[i]].y, x1: p.c, y1: p.r, spin: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()) }));
    await this.tw.tween(200, (p) => {
      for (const m of moves) {
        m.t.x = m.x0 + (c - m.x0) * p * 0.6;
        m.t.y = m.y0 + (r - m.y0) * p * 0.6;
        m.t.scale = 1 - 0.3 * p * J;
        m.t.rot = m.spin * p * Math.PI * J;
      }
    }, ease.inQuad);
    this.fx.shake(3);
    await this.tw.tween(340, (p) => {
      for (const m of moves) {
        const sx = m.x0 + (c - m.x0) * 0.6, sy = m.y0 + (r - m.y0) * 0.6;
        m.t.x = sx + (m.x1 - sx) * p;
        m.t.y = sy + (m.y1 - sy) * p;
        m.t.scale = 1 - 0.3 * J + 0.3 * J * p;
        m.t.rot = m.spin * (1 - p) * Math.PI * J;
      }
    }, ease.outBack);
    for (const m of moves) {
      m.t.x = m.x1; m.t.y = m.y1; m.t.scale = 1; m.t.rot = 0;
      this.faces.set(m.t, 'glance', 500, PRIO.REACT, Math.random() < 0.5);
    }
    await this.tw.wait(60);
  }

  async playSwap(a, b) {
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
      this.sound.play('miss'); // 아~ 오
      await this.animateSwap(ta, b, a, tb);
      // 헛스왑: 둘 다 삐져서 도리도리
      for (const t of [ta, tb]) {
        this.faces.set(t, 'sulk', 900, PRIO.REACT);
        this.faces.headShake(t);
      }
      return;
    }
    await this.resolve([b, a]);
  }

  // 안전장치: 예외나 멈춤이 생기면 보드를 정상 상태로 되돌린다 (빈칸 채우기, 위치 정렬, 둘 곳 확보)
  repairBoard() {
    this.dying = [];
    const board = this.board;
    if (!board) return;
    if (board.cells.some((t) => !t)) board.collapse();
    board.cells.forEach((t, i) => {
      const [r, c] = board.rc(i);
      Object.assign(t, { x: c, y: r, scale: 1, sx: 1, sy: 1, alpha: 1, jx: 0, flash: 0 });
      this.faces.cancelMotion(t);
      this.faces.reset(t);
    });
    if (board.findMatches().groups.length || !board.findMove()) {
      board.shuffle();
      board.cells.forEach((t, i) => { const [r, c] = board.rc(i); t.x = c; t.y = r; });
    }
  }

  // 매 프레임: 둘 곳이 없는데 멈춰 있으면 섞고, 너무 오래 busy면 복구
  watchdog() {
    const now = this.tw.time;
    if (this.busy) {
      if (this.busySince && now - this.busySince > 12000) {
        console.warn('watchdog: busy too long, repairing');
        this.repairBoard();
        this.endTurn();
      }
      return;
    }
    if (!this.board || now - (this.lastMoveCheck || 0) < 500) return;
    this.lastMoveCheck = now;
    if (!this.board.findMove()) {
      this.busy = true;
      this.busySince = now;
      this.shuffleBoard().catch((err) => { console.error(err); this.repairBoard(); }).finally(() => this.endTurn());
    }
  }

  endTurn() {
    this.busy = false;
    this.busySince = 0;
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
    this.spot = null;
    this.lastMatch = this.tw.time;
    let cascade = 0;
    for (;;) {
      // 폭발에 휘말렸던 카이주가 다시 쌓인 판 위에 나타나 걸어감
      if (this.deferredKaiju.length) {
        const k = this.deferredKaiju.shift();
        const ki = this.chars.findIndex((ch) => ch.item === 'kaiju');
        await this.resolveStep({ groups: [], matched: new Set() }, Math.max(cascade, 1), null,
          [{ i: this.board.idx(k.r, k.c), effect: EFFECTS.kaiju, soundType: ki }]);
        if (this.score >= this.target()) { await this.levelClear(); return; }
        await this.animateFalls(this.collapse());
        continue;
      }
      const m = this.board.findMatches();
      if (m.groups.length === 0) break;
      cascade++;
      await this.resolveStep(m, cascade, cascade === 1 ? swapCells : null);
      if (this.score >= this.target()) {
        await this.levelClear();
        return;
      }
      await this.animateFalls(this.collapse());
    }
    // 가능한 수가 없으면 알림 없이 셔플
    if (this.fullShuffle) { this.fullShuffle = false; await this.shuffleBoard(); return; }
    if (!this.board.findMove()) await this.shuffleBoard();
  }

  // 둘 곳이 없을 때: "리셔플!"을 먼저 띄우고, 가운데로 빨려 들었다가 빙글빙글 새 자리로 흩어짐
  async shuffleBoard() {
    this.selected = null;
    this.clearHint();
    this.spot = null;
    // 1) 먼저 "리셔플!"을 띄우고, 얼굴들이 놀라 부들부들 떠는 동안 잠깐 기다림
    this.showBanner('리셔플!');
    this.sound.play('chain', 5);
    this.vibrate(20);
    for (const t of this.board.cells) {
      if (!t) continue;
      this.faces.cancelMotion(t);
      this.faces.set(t, 'shock', 1600, PRIO.MOVE);
    }
    await this.tw.tween(650, () => {
      for (const t of this.board.cells) if (t) t.jx = (Math.random() * 2 - 1) * 1.5 * Math.min(this.J, 1.5);
    });
    for (const t of this.board.cells) if (t) t.jx = 0;
    this.board.shuffle();
    const cx = (this.cfg.COLS - 1) / 2, cy = (this.cfg.ROWS - 1) / 2;
    const moves = [];
    for (let r = 0; r < this.cfg.ROWS; r++) {
      for (let c = 0; c < this.cfg.COLS; c++) {
        const t = this.board.get(r, c);
        moves.push({ t, x0: t.x, y0: t.y, x1: c, y1: r, spin: (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()) });
      }
    }
    const J = Math.min(this.J, 1.5);
    // 2) 가운데로 모이며 작아짐
    await this.tw.tween(260, (p) => {
      for (const m of moves) {
        m.t.x = m.x0 + (cx - m.x0) * p * 0.7;
        m.t.y = m.y0 + (cy - m.y0) * p * 0.7;
        m.t.scale = 1 - 0.35 * p * J;
        m.t.rot = m.spin * p * Math.PI * J;
      }
    }, ease.inQuad);
    this.fx.shake(4);
    // 3) 빙글 돌며 새 자리로 흩어짐
    await this.tw.tween(420, (p) => {
      for (const m of moves) {
        const sx = m.x0 + (cx - m.x0) * 0.7, sy = m.y0 + (cy - m.y0) * 0.7;
        m.t.x = sx + (m.x1 - sx) * p;
        m.t.y = sy + (m.y1 - sy) * p;
        m.t.scale = 1 - 0.35 * J + 0.35 * J * p;
        m.t.rot = m.spin * (1 - p) * Math.PI * J;
      }
    }, ease.outBack);
    for (const m of moves) {
      m.t.x = m.x1; m.t.y = m.y1; m.t.scale = 1; m.t.rot = 0;
      this.faces.set(m.t, 'glance', 500, PRIO.REACT, Math.random() < 0.5);
    }
  }

  // 판 클리어: 보드 전체가 아래에서 위로 순차 터지고, 다음 판 보드가 쏟아져 내려옴
  async levelClear() {
    this.selected = null;
    this.clearHint();
    this.vibrate([30, 50, 30]);
    this.sound.play('clear');
    // 타임 보너스: 빨리 깰수록 남은 초 × 1초당 점수 (판이 높을수록 큼)
    const bonus = this.bonusLeft() * this.bonusPerSec();
    if (bonus > 0) {
      this.addTotal(bonus);
      this.save();
      this.renderScore();
      this.updateHud();
    }
    this.showBanner(`판 ${this.level} 클리어!`, bonus > 0 ? `⏱ 타임 보너스 +${bonus.toLocaleString()}` : '', bonus > 0);
    // 보너스 숫자가 0부터 촤르르 올라감
    const subEl = bonus > 0 && this.hud.banner && this.hud.banner.querySelector('.sub');
    if (subEl) {
      this.tw.tween(900, (p) => { subEl.textContent = `⏱ 타임 보너스 +${Math.round(bonus * p).toLocaleString()}`; }, ease.outQuad, 250);
      for (let i = 0; i < 6; i++) this.tw.after(250 + i * 140, () => this.sound.play('land'));
    }

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
    // 타임 보너스가 있으면 읽을 시간을 넉넉히
    await this.tw.wait(Math.max(last + 120 + 450, bonus > 0 ? 2600 : 0));
    this.dying = [];
    await this.startLevel(this.level + 1);
  }

  // long: 더 오래 떠 있는 배너 (타임 보너스)
  showBanner(text, sub = '', long = false) {
    const el = this.hud.banner;
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('long', long);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sub;
      el.appendChild(s);
    }
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

  // 오래 못 맞추면: 맞춰질 줄을 금빛 테두리로, 옮길 타일에서 목적지로 화살표
  updateSpot() {
    if (this.busy || !this.board) return;
    const now = this.tw.time;
    if (this.spot && !this.board.wouldMatch(this.spot.a, this.spot.b)) this.spot = null;
    if (this.spot || now - this.lastMatch < this.cfg.SPOTLIGHT_DELAY_MS) return;
    const mv = this.board.findMove();
    if (!mv) return;
    const [a, b] = mv;
    const cells = this.board.matchCellsFor(a, b);
    // 옮길 타일: 자기 인물로 맞춰지는 칸으로 가는 쪽
    const has = (p) => cells.some((q) => q.r === p.r && q.c === p.c);
    const ta = this.board.get(a.r, a.c);
    const aMoves = has(b) && cells.some((q) => this.board.typeAt(q.r, q.c) === ta.type && !(q.r === b.r && q.c === b.c) && !(q.r === a.r && q.c === a.c));
    const [from, to] = aMoves ? [a, b] : [b, a];
    this.spot = { a, b, cells, from, to, t0: now };
  }

  drawSpot(ts) {
    const sp = this.spot;
    if (!sp || this.busy) return;
    const ctx = this.ctx;
    const t = (this.tw.time - sp.t0) / 1000;
    const fade = Math.min(1, t * 3);
    const pulse = 0.5 + 0.5 * Math.sin(ts / 180);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = 'rgba(255,200,40,0.95)';
    ctx.shadowBlur = 10 + 10 * pulse;
    ctx.strokeStyle = `rgba(255,${210 + 30 * pulse | 0},${60 + 80 * pulse | 0},1)`;
    ctx.lineWidth = 3.5 + 1.5 * pulse;
    const s = this.T + 2 + 3 * pulse;
    // 바꾼 뒤 기준 칸이므로, 목적지 칸 대신 옮길 타일의 현재 칸을 표시
    for (const q of sp.cells) {
      const p = q.r === sp.to.r && q.c === sp.to.c ? sp.from : q;
      this.roundRect(this.cx(p.c) - s / 2, this.cy(p.r) - s / 2, s, s, 12);
      ctx.stroke();
    }
    // 화살표: 옮길 타일 → 목적지, 그쪽으로 살짝 밀려 나감
    const dx = sp.to.c - sp.from.c, dy = sp.to.r - sp.from.r;
    const push = 4 + 6 * pulse;
    const mx = (this.cx(sp.from.c) + this.cx(sp.to.c)) / 2 + dx * push;
    const my = (this.cy(sp.from.r) + this.cy(sp.to.r)) / 2 + dy * push;
    const L = this.T * 0.22;
    ctx.translate(mx, my);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.beginPath();
    ctx.moveTo(L, 0);
    ctx.lineTo(-L * 0.6, -L * 0.85);
    ctx.lineTo(-L * 0.6, L * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#FFD84A';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#5a3a00';
    ctx.stroke();
    ctx.restore();
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

  // 빈칸 채우기 + 대기 중인 아이템을 새로 떨어지는 타일 중 하나로 바꿔 내려보냄
  collapse() {
    const falls = this.board.collapse();
    if (!this.pendingItems.length) return falls;
    const fresh = falls.filter((f) => f.fromY < 0 && !f.tile.special);
    while (this.pendingItems.length && fresh.length) {
      const kind = this.pendingItems.shift();
      const f = fresh.splice(Math.floor(Math.random() * fresh.length), 1)[0];
      const idx = this.chars.findIndex((ch) => ch.item === kind);
      if (idx < 0) continue;
      // 핵폭탄·ICBM은 같은 것끼리 맞출 수 있고(셋 맞추면 대폭발), 시한폭탄은 매치되지 않음
      Object.assign(f.tile, { type: idx, special: true, item: kind, noMatch: kind === 'timebomb' });
      // 시한폭탄: 떨어지는 시간(0.6초) 뒤부터 카운트다운
      if (kind === 'timebomb') { f.tile.fuse = this.tw.time + FUSE_MS + 600; f.tile.shownDigit = -1; }
    }
    this.pendingItems.length = 0;
    return falls;
  }

  // 지울 때마다 아이템이 생길지 정한다
  rollItems(m, cascade, swapCells) {
    // ICBM (1판부터): 한 번 옮겨서 3개짜리 두 줄 이상을 동시에 지우면
    if (cascade === 1 && swapCells && m.groups.length >= 2) this.pendingItems.push('missile');
    // 콤보(연쇄)가 나오면 ICBM 하나 (한 번 옮길 때 한 개: 연쇄 2단계에서)
    if (cascade === 2) this.pendingItems.push('missile');
    // 11판부터 시한폭탄: 지울 때마다 1/10 (21판부터 판마다 점점 드물게)
    if (this.level >= 11 && Math.random() < 1 / this.itemOdds()) this.pendingItems.push('timebomb');
    // 21판부터 드론: 처음엔 1/6, 판마다 점점 드물게 (22판 1/7, 23판 1/8 …)
    if (this.level >= 21 && Math.random() < 1 / (6 + this.level - 21)) this.pendingItems.push('drone');
    // 31판부터 카이주: 처음엔 1/8, 판마다 점점 드물게
    if (this.level >= 31 && Math.random() < 1 / (8 + this.level - 31)) this.pendingItems.push('kaiju');
    // 41판 UFO, 51판 관세, 61판 핵폭탄, 71판 기밀 파일: 처음엔 1/8(핵폭탄 1/10), 판마다 점점 드물게
    if (this.level >= 41 && Math.random() < 1 / (8 + this.level - 41)) this.pendingItems.push('ufo');
    if (this.level >= 51 && Math.random() < 1 / (8 + this.level - 51)) this.pendingItems.push('tariff');
    if (this.level >= 61 && Math.random() < 1 / (10 + this.level - 61)) this.pendingItems.push('nuke');
    if (this.level >= 71 && Math.random() < 1 / (8 + this.level - 71)) this.pendingItems.push('secrets');
  }

  // 아이템 확률의 분모: 20판까지 10, 21판 11, 22판 12 ...
  itemOdds() {
    const base = this.cfg.ITEM_ODDS || 10;
    const from = this.cfg.ITEM_ODDS_FROM || 21;
    return base + Math.max(0, this.level - from + 1);
  }

  // 시한폭탄: 숫자가 바뀔 때 삑, 0이 지나면 (다른 연출이 끝난 뒤) 폭발
  updateTimebombs() {
    if (!this.board) return;
    const now = this.tw.time;
    for (let i = 0; i < this.board.cells.length; i++) {
      const t = this.board.cells[i];
      if (!t || t.item !== 'timebomb') continue;
      const d = this.fuseDigit(t);
      if (d !== t.shownDigit) {
        t.shownDigit = d;
        this.sound.play('beep', d === 0 ? 7 : 0);
      }
      if (now >= t.fuse && !this.busy) {
        const [r, c] = this.board.rc(i);
        this.detonate({ r, c }, true);
        return;
      }
    }
  }

  fuseDigit(t) {
    // FUSE_FROM…1을 1초씩, 마지막 SHAKE_MS 동안 0 (부르르)
    return Math.max(0, Math.min(FUSE_FROM, Math.ceil((t.fuse - SHAKE_MS - this.tw.time) / 1000)));
  }

  // extraTriggers: [{ i, effect, soundType }] — 매치와 별개로 그 칸에서 바로 발동시킬 효과 (나중에 나타나는 카이주)
  async resolveStep(m, cascade, swapCells, extraTriggers = []) {
    const J = this.J;
    const board = this.board;
    const rows = this.cfg.ROWS, cols = this.cfg.COLS;
    this.rollItems(m, cascade, swapCells);
    const HIT = J > 0 ? 40 : 0;

    // 1) 4개 이상 매치 그룹 → 특수 타일 생성 위치 (스왑한 칸 우선, 없으면 그룹 중심에 가까운 칸)
    const spawns = [];
    for (const g of m.groups) {
      if (g.cells.length < 4) continue;
      if (this.chars[g.type] && this.chars[g.type].item) continue; // 아이템 줄은 특수 타일을 만들지 않음
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
    const chained = []; // 다른 특수 효과에 맞아 연쇄 발동하는 특수 타일
    const sinkTo = new Map(); // idx → 빨려 들어갈 칸 (방사능 홍차)
    const plays = [];
    // 아이템 셋 이상을 한 줄로 맞추면: 가운데 하나가 크게 터지고 나머지는 그냥 사라짐
    //   NUKE·ICBM 셋 → 화면 전체 폭발, 드론 셋 → 날아가서 3×3
    const BIG = { nuke: EFFECTS.screen, missile: EFFECTS.screen, drone: EFFECTS.droneStrike3, tariff: EFFECTS.bomb, ufo: EFFECTS.ufoStrike3, secrets: EFFECTS.secrets3, kaiju: EFFECTS.kaiju5 };
    const bigAt = new Map();
    for (const g of m.groups) {
      const big = this.chars[g.type] && BIG[this.chars[g.type].item];
      if (!big || g.cells.length < 3) continue; // 하나만 누른 건 보통 크기 (셋 이상 맞춰야 대폭발)
      const sorted = [...g.cells].sort((a, b) => a - b);
      const mid = sorted[Math.floor(sorted.length / 2)];
      bigAt.set(mid, big);
      if (this.chars[g.type].item === 'tariff') this.fullShuffle = true; // 관세 셋: 3×3 터지고 나서 전체 리셔플
      for (const i of sorted) if (i !== mid) { fired.add(i); popAt.set(i, HIT); }
    }
    for (const e of extraTriggers) triggers.push({ i: e.i, t: HIT, effect: e.effect, soundType: e.soundType });
    for (const i of m.matched) {
      if (fired.has(i)) continue;
      if (bigAt.has(i)) triggers.push({ i, t: HIT, effect: bigAt.get(i) });
      else if (board.cells[i].special) triggers.push({ i, t: HIT });
      else popAt.set(i, HIT);
    }
    while (triggers.length) {
      triggers.sort((a, b) => a.t - b.t);
      const { i, t, effect: override, chained: isChained, soundType } = triggers.shift();
      if (fired.has(i)) continue;
      fired.add(i);
      const tile = board.cells[i];
      const ch = this.chars[tile.type];
      const effect = override || EFFECTS[ch.effect || ch.group];
      popAt.set(i, t);
      if (!effect) continue;
      const [r, c] = board.rc(i);
      // 폭발에 휘말린 카이주: 지금은 사라지고, 이 폭발이 끝나 빈칸이 다시 채워진 뒤 그 자리에 나타나 걸어감
      if (isChained && tile.item === 'kaiju' && !override) { this.deferredKaiju.push({ r, c }); continue; }
      const area = effect.area(r, c, rows, cols, board, tile.type, popAt); // popAt: 이미 터지기로 한 칸
      plays.push({ t, effect, r, c, area, type: soundType ?? tile.type, big: override === EFFECTS.screen });
      for (const a of area) {
        const j = board.idx(a.r, a.c);
        const tt = t + a.delay;
        if (a.sink) sinkTo.set(j, a.sink); // 터지지 않고 빨려 들어감
        if (j === i) { popAt.set(i, tt); continue; }
        const other = board.cells[j];
        if (!other) continue;
        if (other.item === 'timebomb') continue; // 시한폭탄은 휘말려도 안 터짐 (시간이 돼야만)
        if (other.special) { if (!fired.has(j)) { triggers.push({ i: j, t: tt + CHAIN_DELAY, chained: true }); chained.push({ tile: other, t: tt }); } }
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
      const sink = sinkTo.get(e.i);
      if (sink) end = Math.max(end, d + 420);
      this.tw.after(d, () => {
        if (sink) this.sinkTile(e.tile, sink);
        else this.popTile(e.tile, e.tile.special ? 2 : 1);
        this.reactAround(pr, pc);
      });
    }
    for (const ch of chained) {
      this.tw.after(Math.max(0, ch.t - HIT), () => {
        this.tw.tween(CHAIN_DELAY, (p) => {
          ch.tile.jx = (Math.random() * 2 - 1) * 4 * Math.min(this.J, 1.5);
          ch.tile.scale = 1 + 0.25 * p * Math.min(this.J, 1.5);
        }).then(() => { ch.tile.jx = 0; });
      });
    }
    for (const pl of plays) {
      this.tw.after(pl.t - HIT, () => {
        pl.effect.play(this, pl.r, pl.c, rows, cols, pl.area);
        this.reactToSpecial(pl, doomed);
        this.fx.flash(pl.big ? 0.9 : 0.35);
        this.fx.shake(pl.big ? 10 : 8);
        this.vibrate(pl.big ? [40, 30, 60] : 30);
        this.sound.special(this.chars[pl.type]); // 국기 방귀, 테슬라 부르릉, 로켓 콰광 ...
        if (pl.big) this.sound.play('special_fart'); // 아이템 셋: 방귀 한 방 더
      });
    }
    for (const sp of spawns) {
      end = Math.max(end, 100 + 150);
      this.spawnSpecial(sp);
    }
    await this.tw.wait(end);

    // 4개짜리 ×2, 5개 이상 ×4: 그 줄의 칸 수만큼 점수를 더 얹는다 (폭발·연쇄로 터진 칸은 그대로)
    let extra = 0;
    for (const g of m.groups) {
      const mult = this.matchMult(g.cells.length);
      if (mult <= 1) continue;
      extra += g.cells.length * (mult - 1);
      let sx = 0, sy = 0;
      for (const i of g.cells) { const [r, c] = board.rc(i); sx += this.cx(c); sy += this.cy(r); }
      this.fx.popup(sx / g.cells.length, sy / g.cells.length - 30, `${g.cells.length}개! ×${mult}`, '#FFD84A', 22);
    }
    this.addScore(removed.length + extra, cascade, [...m.matched]);
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
    // 흔들림: 한 번에 4개 이상 터지면 살짝, 연쇄가 이어질수록 크게 (최대 10px)
    const big = cells.length >= 4 ? 2 : 0;
    if (cascade >= 2 || big) this.fx.shake(Math.min(Math.max(big, 2 * (cascade - 1)), 10));
    // 연쇄: 보드 여기저기서 깜짝 놀라 펄쩍 (연쇄가 클수록 많이)
    if (cascade >= 2) {
      const chance = Math.min(0.3 + 0.15 * (cascade - 2), 0.8);
      for (const t of this.board.cells) {
        if (t && Math.random() < chance && this.faces.set(t, 'shock', 380, PRIO.REACT)) this.faces.hop(t, 4 + cascade, 260);
      }
    }
  }

  // 한 줄 길이별 점수 배율: 3개 ×1, 4개 ×2, 5개 이상 ×4 (config MATCH_MULT)
  matchMult(n) {
    const t = this.cfg.MATCH_MULT || { 4: 2, 5: 4 };
    let m = 1;
    for (const k of Object.keys(t).map(Number).sort((a, b) => a - b)) if (n >= k) m = t[k];
    return m;
  }

  addScore(count, cascade, cells = null) {
    const pts = Math.floor(count * 10 * Math.pow(1.5, cascade - 1));
    this.score += pts;
    this.addTotal(pts);
    this.save(); // 나갔다 와도 이어하기
    this.updateHud();
    if (cells && cells.length) {
      let sx = 0, sy = 0;
      for (const i of cells) { const [r, c] = this.board.rc(i); sx += this.cx(c); sy += this.cy(r); }
      this.fx.popup(sx / cells.length, sy / cells.length + (cascade >= 2 ? 26 : 0), `+${pts}`);
    }
    return pts;
  }

  // 터진 칸 주변 8칸: 폭발 쪽을 쳐다보며 움찔
  // 그 바깥 2칸은 폭발 쪽을 쳐다봄
  // 카이주가 밟은 칸 주변: 바로 옆은 비명 지르며 덜덜, 두 칸 거리는 깜짝 놀라 살짝 떪
  kaijuScare(r, c) {
    const near = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const t = this.board && this.board.get(r + dr, c + dc);
        if (!t || t.special) continue;
        const d = Math.max(Math.abs(dr), Math.abs(dc));
        this.faces.cancelMotion(t);
        // 비명(scream)과 겁먹음(fall)을 무작위로 번갈아
        const first = Math.random() < 0.5 ? 'scream' : 'fall';
        const prio = d <= 1 ? PRIO.DOOM : PRIO.MOVE;
        const dur = d <= 1 ? 750 : 550;
        this.faces.set(t, first, dur, prio);
        const flips = 1 + Math.floor(Math.random() * 2);
        for (let k = 1; k <= flips; k++) {
          this.tw.after((dur / (flips + 1)) * k + Math.random() * 60, () => {
            if (t.exprPrio === prio && (t.expr === 'scream' || t.expr === 'fall')) {
              t.expr = t.expr === 'scream' ? 'fall' : 'scream';
            }
          });
        }
        near.push({ t, amp: d <= 1 ? 3.2 : 1.6 });
      }
    }
    if (!near.length || this.J <= 0) return;
    this.tw.tween(450, (p) => {
      for (const n of near) n.t.jx = (Math.random() * 2 - 1) * n.amp * (1 - p) * Math.min(this.J, 1.5);
    }).then(() => { for (const n of near) n.t.jx = 0; });
  }

  reactAround(r, c) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (!dr && !dc) continue;
        const t = this.board.get(r + dr, c + dc);
        if (!t) continue;
        if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) this.faces.flinch(t, c, r);
        else this.faces.lookAt(t, c, r, 500);
      }
    }
  }

  // 특수 발동: 영향 범위 안의 타일은 공포, 가까운 타일은 크게 움찔, 나머지는 쳐다봄
  // doomed: 이번 스텝에 터질 타일 (idx → tile, 이미 그리드에서 빠져 있음)
  reactToSpecial(pl, doomed) {
    const board = this.board;
    const area = new Set(pl.area.map((a) => board.idx(a.r, a.c)));
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
      t.flash = Math.max(0, 1 - p * 2.5); // 터지는 순간 하얗게 번쩍
    }, ease.outQuad);
  }

  // 쑤욱: 가운데 칸으로 빙글 돌며 빨려 들어가 작아지고 사라짐 (방사능 홍차)
  sinkTile(t, to) {
    this.faces.set(t, 'fall', Infinity, PRIO.DOOM);
    const x0 = t.x, y0 = t.y, spin = (Math.random() < 0.5 ? -1 : 1) * Math.PI * 1.5;
    return this.tw.tween(400, (p) => {
      t.x = x0 + (to.c - x0) * p;
      t.y = y0 + (to.r - y0) * p;
      t.scale = 1 - p;
      t.rot = spin * p;
      t.alpha = 1 - p * p;
    }, ease.inQuad).then(() => { t.alpha = 0; });
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
    this.sound.play('land'); // 또르르
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
    if (this.hud.high) this.hud.high.textContent = this.high.toLocaleString();
    this.hud.bar.style.width = `${Math.min(100, (this.score / target) * 100)}%`;
    this.renderScore();
  }

  renderScore() {
    this.hud.score.textContent = Math.round(this.shownScore).toLocaleString();
    // 전체 점수도 판 점수와 같이 올라가게 (아직 안 올라간 만큼 빼서 표시)
    const shownTotal = Math.round(this.total - (this.score - this.shownScore));
    if (this.hud.total) this.hud.total.textContent = shownTotal.toLocaleString();
    // 하이스코어를 갱신 중이면 총점과 같이 올라가고, 아니면 기록 그대로
    if (this.hud.high) this.hud.high.textContent = (this.high > this.total ? this.high : shownTotal).toLocaleString();
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
    this.updateTimer();
    this.updateTimebombs();
    this.fx.update(dt);
    this.faces.update();
    this.watchdog();
    this.updateHint();
    this.updateSpot();
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

    this.drawSpot(ts);
    this.fx.draw(ctx);

    if (this.fx.flashA > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${this.fx.flashA})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
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
    // 시한폭탄이 0이면 부르르
    const fuse = t.item === 'timebomb' ? this.fuseDigit(t) : -1;
    if (fuse === 0) ox += (Math.random() * 2 - 1) * 5;
    let oy = (t.hy || 0) + t.oy;
    // 드론은 판 위에서 둥실둥실, 살짝 기우뚱 (날 수 있다는 표시)
    if (t.item === 'drone' || t.item === 'ufo') { oy += Math.sin(ts / 260 + t.phase) * 3.5 - 2; ox += Math.sin(ts / 410 + t.phase) * 1.5; }
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
    // 특수 타일: 빛이 사선으로 훑고 지나감 (1.6초마다)
    if (t.special && this.J > 0) {
      const ph = ((ts + t.phase * 400) % 1600) / 1600;
      if (ph < 0.45) {
        const x = -T + (ph / 0.45) * T * 2;
        ctx.save();
        this.roundRect(-T / 2 + 1, -T + 1, T - 2, T - 2, T * 0.22);
        ctx.clip();
        const g = ctx.createLinearGradient(x - T / 2 - 12, -T, x - T / 2 + 12, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-T / 2, -T, T, T);
        ctx.restore();
      }
    }
    if (fuse >= 0) this.drawDigit(fuse, 0, -T * 0.46, T * 0.24, ts);
    if (t.flash > 0) {
      ctx.globalAlpha = t.alpha * t.flash * 0.85;
      ctx.fillStyle = '#ffffff';
      this.roundRect(-T / 2 + 1, -T + 1, T - 2, T - 2, T * 0.22);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 빨간 7세그먼트 디지털 숫자 (cx, cy 중심, 높이 h)
  drawDigit(n, cx, cy, h, ts) {
    const ctx = this.ctx;
    const SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'][n] || '';
    const w = h * 0.55, th = h * 0.13, hw = w / 2, hh = h / 2;
    const seg = {
      a: [-hw, -hh, hw, -hh], g: [-hw, 0, hw, 0], d: [-hw, hh, hw, hh],
      f: [-hw, -hh, -hw, 0], b: [hw, -hh, hw, 0], e: [-hw, 0, -hw, hh], c: [hw, 0, hw, hh],
    };
    const blink = n === 0 && Math.floor(ts / 120) % 2 === 0;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineCap = 'round';
    ctx.lineWidth = th;
    // 꺼진 세그먼트는 어둡게
    ctx.strokeStyle = 'rgba(255,40,40,0.12)';
    for (const k of 'abcdefg') { const [x0, y0, x1, y1] = seg[k]; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.strokeStyle = blink ? '#ffffff' : '#ff2b2b';
    ctx.shadowColor = 'rgba(255,30,30,0.9)';
    ctx.shadowBlur = h * 0.35;
    for (const k of SEG) { const [x0, y0, x1, y1] = seg[k]; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.restore();
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
