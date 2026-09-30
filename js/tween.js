// 게임 루프 시간으로 도는 트윈/타이머. 모든 연출 타이밍은 여기서 나온다.

export const ease = {
  linear: (t) => t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inQuad: (t) => t * t,
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const s = 1.70158; const u = t - 1; return 1 + u * u * ((s + 1) * u + s); },
};

// 목표 지점을 overshoot 비율만큼 지나쳤다가 돌아오는 곡선 (0→1+o→1)
export function overshoot(o) {
  return (t) => {
    const k = 0.7;
    if (t < k) return (1 + o) * ease.outQuad(t / k);
    return 1 + o - o * ease.inOutQuad((t - k) / (1 - k));
  };
}

export class Tweener {
  constructor() {
    this.time = 0;
    this.items = [];
  }

  update(dt) {
    this.time += dt;
    const list = this.items;
    this.items = [];
    const keep = [];
    for (const it of list) {
      if (this.time < it.start) { keep.push(it); continue; }
      const t = it.dur <= 0 ? 1 : (this.time - it.start) / it.dur;
      if (t >= 1) {
        it.fn && it.fn(1);
        it.resolve();
      } else {
        it.fn && it.fn(it.ease(t));
        keep.push(it);
      }
    }
    // update 도중 새로 추가된 항목 보존
    this.items = keep.concat(this.items);
  }

  // dur ms 동안 fn(progress) 호출. delay ms 후 시작.
  tween(dur, fn, easing = ease.linear, delay = 0) {
    return new Promise((resolve) => {
      if (dur <= 0 && delay <= 0) {
        fn && fn(1);
        resolve();
        return;
      }
      this.items.push({ start: this.time + delay, dur, fn, ease: easing, resolve });
    });
  }

  wait(ms) { return this.tween(ms, null, ease.linear, 0); }

  after(ms, fn) { return this.tween(0, () => fn(), ease.linear, ms); }
}
