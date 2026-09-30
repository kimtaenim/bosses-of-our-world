// 표정 연출 담당: 상황별 표정 전환 + 평소 딴짓 + 주변 반응(움찔·쳐다보기) + 몸짓.
//
// 표정 우선순위(prio): 0 평소 / 1 반응 / 2 이동(낙하·착지) / 3 최후(놀람·비명)
// 높은 우선순위 표정이 살아 있는 동안에는 낮은 것이 덮어쓰지 못한다.
// 몸짓(ox, oy, rot)은 타일마다 한 번에 하나만 돌고, 새 몸짓이 이전 것을 끊는다.

export const PRIO = { IDLE: 0, REACT: 1, MOVE: 2, DOOM: 3 };

const rand = (a, b) => a + Math.random() * (b - a);

export class Faces {
  constructor(game) {
    this.g = game;
  }

  get now() { return this.g.tw.time; }

  // 몸짓 크기 배율 (JUICE, reduced-motion 반영)
  get amp() { return this.g.fx.reduced ? 0 : this.g.J; }

  get activity() { return Math.max(0, this.g.cfg.IDLE_ACTIVITY ?? 1); }

  set(t, expr, dur = Infinity, prio = PRIO.REACT, flip = false) {
    if (!t || t.special) return false;
    if (t.exprUntil > this.now && prio < t.exprPrio) return false;
    t.expr = expr;
    t.exprUntil = this.now + dur;
    t.exprPrio = prio;
    t.flip = flip;
    return true;
  }

  reset(t) {
    t.expr = 'smirk';
    t.exprUntil = 0;
    t.exprPrio = 0;
    t.flip = false;
  }

  // ---------- 몸짓 ----------

  motion(t, dur, fn) {
    const id = ++t.motion;
    const amp = this.amp;
    if (amp <= 0) return;
    this.g.tw.tween(dur, (p) => { if (t.motion === id) fn(p, amp); })
      .then(() => { if (t.motion === id) { t.ox = 0; t.oy = 0; t.rot = 0; } });
  }

  cancelMotion(t) {
    t.motion++;
    t.ox = 0; t.oy = 0; t.rot = 0;
  }

  hop(t, height = 6, dur = 300) {
    this.motion(t, dur, (p, a) => { t.oy = -Math.sin(p * Math.PI) * height * a; });
  }

  headShake(t, dur = 420) {
    this.motion(t, dur, (p, a) => { t.rot = Math.sin(p * Math.PI * 5) * 0.16 * (1 - p) * a; });
  }

  // ---------- 반응 ----------

  // (x, y) 칸에서 폭발 → 폭발 쪽을 쳐다보며 반대쪽으로 움찔
  flinch(t, x, y, strong = false) {
    if (!t) return;
    const dx = t.x - x, dy = t.y - y;
    const lookLeft = dx > 0;
    const close = Math.max(Math.abs(dx), Math.abs(dy)) <= 1;
    if (strong || (dx === 0 && close)) this.set(t, 'shock', 450, PRIO.REACT);
    else this.set(t, 'glance', 550, PRIO.REACT, lookLeft);
    const len = Math.hypot(dx, dy) || 1;
    const push = (strong ? 5 : 3.5);
    this.motion(t, 340, (p, a) => {
      const k = (1 - p) * Math.cos(p * Math.PI * 2.5) * push * a;
      t.ox = (dx / len) * k;
      t.oy = (dy / len) * k;
    });
  }

  // (x, y) 칸 쪽을 쳐다봄
  lookAt(t, x, y, dur = 700) {
    if (!t) return;
    if (x === t.x) this.set(t, y < t.y ? 'eyeroll' : 'shock', dur, PRIO.REACT);
    else this.set(t, 'glance', dur, PRIO.REACT, x < t.x);
  }

  // ---------- 평소 딴짓 ----------

  update() {
    const board = this.g.board;
    if (!board) return;
    const now = this.now;
    const act = this.activity;
    const cfg = this.g.cfg;
    for (const t of board.cells) {
      if (!t) continue;
      if (t.exprUntil <= now && (t.exprPrio !== 0 || t.expr !== 'smirk')) this.reset(t);
      if (act <= 0) continue;
      if (!t.nextIdle) t.nextIdle = now + rand(cfg.IDLE_MIN_MS, cfg.IDLE_MAX_MS) / act;
      if (now < t.nextIdle) continue;
      t.nextIdle = now + rand(cfg.IDLE_MIN_MS, cfg.IDLE_MAX_MS) / act;
      if (t.exprPrio === 0) this.idle(t);
    }
  }

  idle(t) {
    if (t.special) {
      // 특수 타일: 으쓱으쓱
      this.motion(t, 520, (p, a) => { t.rot = Math.sin(p * Math.PI * 4) * 0.13 * (1 - p) * a; });
      return;
    }
    // 원화에 실제로 있는 표정만 골라 "눈에 보이는" 변화가 나도록
    const has = (e) => this.g.sprites.has(t.type, e);
    const pool = IDLE_ACTIONS.filter((a) => a.needs.every(has));
    let r = Math.random() * pool.reduce((sum, a) => sum + a.w, 0);
    for (const a of pool) {
      r -= a.w;
      if (r <= 0) { a.run(this, t); return; }
    }
  }
}

// 평소 딴짓 목록: w = 뽑힐 비중, needs = 필요한 표정(원화에 없으면 제외)
const IDLE_ACTIONS = [
  { w: 24, needs: ['glance', 'glance_left'], run(f, t) {
    const left = Math.random() < 0.5;
    f.set(t, 'glance', 700, PRIO.IDLE, left);
    f.motion(t, 700, (p, a) => { t.ox = (left ? -1 : 1) * Math.sin(p * Math.PI) * 3 * a; });
  } },
  { w: 14, needs: ['sulk'], run(f, t) {
    f.set(t, 'sulk', 700, PRIO.IDLE);
    f.headShake(t, 500);
  } },
  { w: 12, needs: ['shock'], run(f, t) { // 헉!
    f.set(t, 'shock', 380, PRIO.IDLE);
    f.hop(t, 6, 240);
  } },
  { w: 8, needs: ['fall'], run(f, t) { // 불안하게 위를 쳐다봄
    f.set(t, 'fall', 600, PRIO.IDLE);
    f.motion(t, 600, (p, a) => { t.oy = -Math.sin(p * Math.PI) * 2 * a; });
  } },
  { w: 4, needs: ['scream'], run(f, t) { // 가끔 괜히 소리 지름
    f.set(t, 'scream', 320, PRIO.IDLE);
    f.motion(t, 320, (p, a) => { t.rot = Math.sin(p * Math.PI * 6) * 0.08 * a; });
  } },
  { w: 10, needs: ['eyeroll'], run(f, t) {
    f.set(t, 'eyeroll', 800, PRIO.IDLE);
    f.motion(t, 800, (p, a) => { t.rot = Math.sin(p * Math.PI) * 0.12 * a; });
  } },
  { w: 10, needs: ['blink'], run(f, t) {
    f.set(t, 'blink', 140, PRIO.IDLE);
  } },
  { w: 10, needs: [], run(f, t) { // 평소 얼굴로 으스대며 깡충 / 까딱
    if (Math.random() < 0.5) f.hop(t, 6, 280);
    else f.motion(t, 700, (p, a) => { t.rot = -Math.sin(p * Math.PI) * 0.12 * a; });
  } },
];
