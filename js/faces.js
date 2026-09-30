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
    t.expr = 'stern';
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
      if (t.exprUntil <= now && (t.exprPrio !== 0 || t.expr !== 'stern')) this.reset(t);
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
    const r = Math.random();
    if (r < 0.26) {
      this.set(t, 'blink', 140, PRIO.IDLE);
      if (Math.random() < 0.3) this.g.tw.after(260, () => this.set(t, 'blink', 120, PRIO.IDLE));
    } else if (r < 0.48) {
      this.set(t, 'eyeroll', 1000, PRIO.IDLE);
      this.motion(t, 1000, (p, a) => { t.rot = Math.sin(p * Math.PI) * 0.12 * a; });
    } else if (r < 0.7) {
      const left = Math.random() < 0.5;
      this.set(t, 'glance', 900, PRIO.IDLE, left);
      this.motion(t, 900, (p, a) => { t.ox = (left ? -1 : 1) * Math.sin(p * Math.PI) * 2.5 * a; });
    } else if (r < 0.84) {
      this.set(t, 'smug', 500, PRIO.IDLE);
      this.hop(t, 5, 280);
    } else if (r < 0.93) {
      this.set(t, 'smug', 1000, PRIO.IDLE);
      this.motion(t, 1000, (p, a) => { t.rot = -Math.sin(p * Math.PI) * 0.1 * a; });
    } else {
      this.set(t, 'sulk', 900, PRIO.IDLE);
      this.headShake(t, 600);
    }
  }
}
