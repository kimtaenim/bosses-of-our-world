// 파티클·링·텍스트·화면 흔들림. 좌표는 보드 논리 px.
// juice: CONFIG.JUICE 배율, reduced: prefers-reduced-motion (흔들림·파티클 끔)

const MAX_PARTICLES = 2500;
const GRAVITY = 1500; // px/s²

const rand = (a, b) => a + Math.random() * (b - a);

export class FX {
  constructor(juice) {
    this.juice = juice;
    this.reduced = false;
    this.particles = [];
    this.rings = [];
    this.texts = [];
    this.beams = [];
    this.shakeAmp = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  get particlesOn() { return this.juice > 0 && !this.reduced; }

  // 타일 파편: 사방으로 튀고 중력 받으며 떨어짐
  burst(x, y, color, count, speed = 1) {
    if (!this.particlesOn) return;
    const n = Math.round(count * Math.min(this.juice, 2));
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(140, 380) * speed * Math.sqrt(this.juice);
      this.particles.push({
        x: x + rand(-8, 8), y: y + rand(-8, 8),
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - rand(80, 220) * speed,
        g: GRAVITY, size: rand(4, 9), color,
        rot: rand(0, Math.PI), vr: rand(-12, 12),
        life: 0, maxLife: rand(0.55, 0.9), kind: 'debris',
      });
    }
  }

  // 착지 먼지 2-3개
  dust(x, y) {
    if (!this.particlesOn) return;
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.particles.push({
        x: x + dir * rand(6, 18), y,
        vx: dir * rand(30, 70) * this.juice, vy: -rand(20, 60) * this.juice,
        g: 200, size: rand(2.5, 4.5), color: 'rgba(230,230,240,0.9)',
        rot: 0, vr: 0, life: 0, maxLife: rand(0.25, 0.4), kind: 'dust',
      });
    }
  }

  // 파편이 (x0,y0)에서 (x1,y1)로 빨려 들어감
  suck(x0, y0, x1, y1, color, count, dur) {
    if (!this.particlesOn) return;
    const n = Math.round(count * Math.min(this.juice, 2));
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push({
        x: x0, y: y0, sx: x0 + rand(-20, 20), sy: y0 + rand(-20, 20), tx: x1, ty: y1,
        size: rand(3.5, 7), color, rot: rand(0, Math.PI), vr: rand(-10, 10),
        life: 0, maxLife: dur / 1000, kind: 'suck',
      });
    }
  }

  // 흰 링: r0 → r1 로 퍼지며 사라짐
  ring(x, y, r0, r1, dur, width = 3, color = '255,255,255') {
    if (this.juice <= 0) return;
    this.rings.push({ x, y, r0, r1, dur: dur / 1000, t: 0, width: width * Math.min(this.juice, 2), color });
  }

  // 연쇄 배수 텍스트
  text(x, y, str, level) {
    if (this.juice <= 0) return;
    const k = Math.min(level - 2, 6) / 6; // 0..1
    const hue = 50 - 50 * k;               // 노랑 → 빨강
    const light = 70 - 20 * k;
    this.texts.push({
      x, y, str, t: 0, dur: 0.75,
      size: (26 + 7 * Math.min(level - 2, 8)) * Math.min(Math.max(this.juice, 0.5), 1.5),
      color: `hsl(${hue}, 100%, ${light}%)`,
    });
  }

  // 세로 빛줄기 (열 제거)
  beam(x, top, bottom, width, dur) {
    if (this.juice <= 0) return;
    this.beams.push({ x, top, bottom, width, dur: dur / 1000, t: 0 });
  }

  shake(px) {
    if (this.reduced || this.juice <= 0) return;
    this.shakeAmp = Math.max(this.shakeAmp, Math.min(px * this.juice, 10 * Math.max(1, this.juice)));
  }

  update(dt) {
    const s = dt / 1000;
    for (const p of this.particles) {
      p.life += s;
      if (p.kind === 'suck') {
        const t = Math.min(p.life / p.maxLife, 1);
        const e = t * t;
        p.x = p.sx + (p.tx - p.sx) * e;
        p.y = p.sy + (p.ty - p.sy) * e;
      } else {
        p.vy += p.g * s;
        p.x += p.vx * s;
        p.y += p.vy * s;
      }
      p.rot += p.vr * s;
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const r of this.rings) r.t += s;
    this.rings = this.rings.filter((r) => r.t < r.dur);
    for (const t of this.texts) t.t += s;
    this.texts = this.texts.filter((t) => t.t < t.dur);
    for (const b of this.beams) b.t += s;
    this.beams = this.beams.filter((b) => b.t < b.dur);

    if (this.shakeAmp > 0.2) {
      this.shakeX = rand(-1, 1) * this.shakeAmp;
      this.shakeY = rand(-1, 1) * this.shakeAmp;
      this.shakeAmp *= Math.exp(-dt / 90);
    } else {
      this.shakeAmp = 0;
      this.shakeX = this.shakeY = 0;
    }
  }

  draw(ctx) {
    for (const b of this.beams) {
      const t = b.t / b.dur;
      const sweep = Math.min(t / 0.7, 1);                 // 위→아래로 훑음
      const headY = b.top + (b.bottom - b.top) * sweep;
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const g = ctx.createLinearGradient(0, b.top, 0, headY);
      g.addColorStop(0, `rgba(255,255,255,${0.15 * fade})`);
      g.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`);
      ctx.fillStyle = g;
      ctx.fillRect(b.x - b.width / 2, b.top, b.width, headY - b.top);
      ctx.fillStyle = `rgba(255,255,220,${fade})`;
      ctx.fillRect(b.x - b.width * 0.18, b.top, b.width * 0.36, headY - b.top);
      ctx.beginPath();
      ctx.arc(b.x, headY, b.width * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
      ctx.fill();
    }

    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.kind === 'suck' ? 1 : t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      ctx.fillStyle = p.color;
      const sz = p.kind === 'suck' ? p.size * (1 - 0.6 * t) : p.size;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    for (const r of this.rings) {
      const t = r.t / r.dur;
      const e = 1 - (1 - t) * (1 - t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * e, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.color},${1 - t})`;
      ctx.lineWidth = r.width * (1 - 0.6 * t);
      ctx.stroke();
    }

    for (const tx of this.texts) {
      const t = tx.t / tx.dur;
      const rise = 1 - Math.pow(1 - t, 3);
      const scale = 0.6 + 0.7 * rise;
      const alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      ctx.save();
      ctx.translate(tx.x, tx.y - 50 * rise);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${tx.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(40,10,0,0.85)';
      ctx.strokeText(tx.str, 0, 0);
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.str, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
