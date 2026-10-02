import { drawDroneShape, drawUfoShape } from './emblems.js';
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
    this.rockets = [];
    this.arcs = []; // 포물선 미사일
    this.drones = []; // 비틀비틀 날아가는 드론
    this.zaps = [];
    this.flashA = 0;   // 화면 전체 흰 번쩍임
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
    // 흰 불꽃: 빠르게 튀었다가 금방 사라짐
    const sparks = Math.round(4 * Math.min(this.juice, 2));
    for (let i = 0; i < sparks && this.particles.length < MAX_PARTICLES; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(300, 560) * speed * Math.sqrt(this.juice);
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        g: 400, size: rand(2.5, 4), color: '#fffbe6',
        rot: 0, vr: 0, life: 0, maxLife: rand(0.18, 0.3), kind: 'spark',
      });
    }
  }

  // 점수 팝업 (+30)
  popup(x, y, str, color = '#ffffff', size = 18) {
    if (this.juice <= 0) return;
    this.texts.push({ x, y, str, t: 0, dur: size > 18 ? 0.9 : 0.65, size, color, kind: 'popup' });
  }

  flash(a) {
    if (this.juice <= 0 || this.reduced) return;
    this.flashA = Math.max(this.flashA, Math.min(1, a * this.juice));
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

  // 가로 빛줄기 (행 제거): x0에서 양쪽 끝(left, right)으로 같은 속도로 뻗어 나감
  beam(y, x0, left, right, height, dur) {
    if (this.juice <= 0) return;
    this.beams.push({ y, x0, left, right, height, dur: dur / 1000, t: 0 });
  }

  // 세로 빛줄기 (열 제거): y0에서 위아래로 뻗어 나감
  vbeam(x, y0, top, bottom, width, dur) {
    if (this.juice <= 0) return;
    this.beams.push({ vertical: true, vx: x, y: 0, x0: y0, left: top, right: bottom, height: width, dur: dur / 1000, t: 0 });
  }

  // 번개: (x0,y0) → (x1,y1) 지그재그 선, delay ms 뒤에 번쩍
  zap(x0, y0, x1, y1, delay = 0, glow = '170,130,255') {
    if (this.juice <= 0) return;
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const off = i === 0 || i === n ? 0 : rand(-10, 10);
      const nx = -(y1 - y0), ny = x1 - x0, len = Math.hypot(nx, ny) || 1;
      pts.push([x0 + (x1 - x0) * k + (nx / len) * off, y0 + (y1 - y0) * k + (ny / len) * off]);
    }
    this.zaps.push({ pts, t: -delay / 1000, dur: 0.22, glow });
  }

  // 로켓: (x, y)에서 위로 가속하며 날아가고 불꽃을 뿜음
  rocket(x, y) {
    if (this.juice <= 0) return;
    this.rockets.push({ x, y, vy: -200, t: 0 });
  }

  // 포물선을 그리며 (x0,y0) → (x1,y1)로 날아가는 미사일. dur 초, peak px만큼 위로 솟음
  arcMissile(x0, y0, x1, y1, dur, peak) {
    if (this.juice <= 0) return;
    this.arcs.push({ x0, y0, x1, y1, dur, peak, t: 0, x: x0, y: y0, ang: 0 });
  }

  // 드론: (x0,y0) → (x1,y1)로 요리조리 비틀비틀 날아감 (dur 초)
  // kind 'ufo'면 빙글빙글 원을 그리며 날아감
  droneFly(x0, y0, x1, y1, dur, size, kind = 'drone') {
    if (this.juice <= 0) return;
    const ph = Math.random() * 6;
    this.drones.push({ x0, y0, x1, y1, dur, size, kind, t: 0, x: x0, y: y0, tilt: 0, ph });
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
    for (const rk of this.rockets) {
      rk.t += s;
      rk.vy -= 2600 * s;
      rk.y += rk.vy * s;
      if (this.particlesOn) {
        for (let k = 0; k < 3 && this.particles.length < MAX_PARTICLES; k++) {
          this.particles.push({
            x: rk.x + rand(-5, 5), y: rk.y + 22, vx: rand(-60, 60), vy: rand(80, 200),
            g: 0, size: rand(4, 8), color: Math.random() < 0.5 ? '#FFB02E' : '#FFF1A8',
            rot: 0, vr: 0, life: 0, maxLife: rand(0.2, 0.35), kind: 'debris',
          });
        }
      }
    }
    this.rockets = this.rockets.filter((rk) => rk.y > -400);
    for (const a of this.arcs) {
      a.t += s;
      const p = Math.min(a.t / a.dur, 1);
      const nx = a.x0 + (a.x1 - a.x0) * p;
      const ny = a.y0 + (a.y1 - a.y0) * p - a.peak * 4 * p * (1 - p);
      a.ang = Math.atan2(ny - a.y, nx - a.x) + Math.PI / 2; // 머리가 진행 방향
      a.x = nx; a.y = ny;
      if (this.particlesOn) {
        for (let k = 0; k < 3 && this.particles.length < MAX_PARTICLES; k++) {
          this.particles.push({
            x: a.x + rand(-4, 4), y: a.y + rand(-4, 4), vx: rand(-40, 40), vy: rand(-40, 40),
            g: 0, size: rand(4, 8), color: Math.random() < 0.5 ? '#FFB02E' : '#d8d8d8',
            rot: 0, vr: 0, life: 0, maxLife: rand(0.25, 0.45), kind: 'debris',
          });
        }
      }
    }
    this.arcs = this.arcs.filter((a) => a.t < a.dur);
    for (const d of this.drones) {
      d.t += s;
      const p = Math.min(d.t / d.dur, 1);
      const e = p * p * (3 - 2 * p);
      const dx = d.x1 - d.x0, dy = d.y1 - d.y0;
      const len = Math.hypot(dx, dy) || 1;
      // 진행 방향에 수직으로 크게 갈지자, 위아래로 둥실, 처음엔 위로 솟음
      let nx, ny;
      if (d.kind === 'ufo') {
        // 빙글빙글: 목적지로 가면서 반지름 커졌다 작아지는 원을 세 바퀴
        const rad = 55 * Math.sin(p * Math.PI);
        const a = d.ph + p * Math.PI * 6;
        nx = d.x0 + dx * e + Math.cos(a) * rad;
        ny = d.y0 + dy * e + Math.sin(a) * rad * 0.6 - 40 * Math.sin(p * Math.PI);
      } else {
        const side = Math.sin(p * Math.PI * 3 + d.ph) * 40 * Math.sin(p * Math.PI);
        const lift = -60 * Math.sin(p * Math.PI);
        const bob = Math.sin(d.t * 22) * 3;
        nx = d.x0 + dx * e + (-dy / len) * side;
        ny = d.y0 + dy * e + (dx / len) * side + lift + bob;
      }
      d.tilt = Math.max(-0.5, Math.min(0.5, (nx - d.x) * 0.08)) + Math.sin(d.t * 9) * 0.12;
      d.x = nx; d.y = ny;
    }
    this.drones = this.drones.filter((d) => d.t < d.dur);
    for (const z of this.zaps) z.t += s;
    this.zaps = this.zaps.filter((z) => z.t < z.dur);
    for (const b of this.beams) b.t += s;
    this.beams = this.beams.filter((b) => b.t < b.dur);

    this.flashA = Math.max(0, this.flashA - dt / 140);

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
      if (b.vertical) {
        ctx.save();
        ctx.translate(b.vx, b.x0);
        ctx.rotate(Math.PI / 2);
        this.drawBeam(ctx, { ...b, x0: 0, y: 0, left: b.left - b.x0, right: b.right - b.x0 });
        ctx.restore();
      } else {
        this.drawBeam(ctx, b);
      }
    }

    for (const rk of this.rockets) this.drawRocket(ctx, rk);
    for (const a of this.arcs) this.drawRocket(ctx, a, a.ang);
    for (const d of this.drones) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.tilt);
      if (d.kind === 'ufo') drawUfoShape(ctx, 0, 0, d.size, d.t * 14);
      else drawDroneShape(ctx, 0, 0, d.size, d.t * 60);
      ctx.restore();
    }

    for (const z of this.zaps) {
      if (z.t < 0) continue;
      const a = 1 - z.t / z.dur;
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (const [w, col] of [[7, `rgba(${z.glow},${0.5 * a})`], [2.5, `rgba(255,255,255,${a})`]]) {
        ctx.beginPath();
        z.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      ctx.restore();
    }

    this.drawParticles(ctx);
    this.drawRest(ctx);
  }

  drawRocket(ctx, rk, ang = 0) {
    ctx.save();
    ctx.translate(rk.x, rk.y);
    if (ang) ctx.rotate(ang);
    const W = 14, L = 40;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1d2747';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-W / 2, L * 0.45);
    ctx.lineTo(-W / 2, -L * 0.1);
    ctx.quadraticCurveTo(-W / 2, -L * 0.5, 0, -L * 0.55);
    ctx.quadraticCurveTo(W / 2, -L * 0.5, W / 2, -L * 0.1);
    ctx.lineTo(W / 2, L * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E8364A';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * W / 2, L * 0.1);
      ctx.lineTo(sgn * W * 1.1, L * 0.5);
      ctx.lineTo(sgn * W / 2, L * 0.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#7CCBF5';
    ctx.beginPath();
    ctx.arc(0, -L * 0.15, W * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawBeam(ctx, b) {
      const t = b.t / b.dur;
      const reach = Math.max(b.x0 - b.left, b.right - b.x0) * Math.min(t / 0.7, 1);
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      const h = b.height;
      for (const dir of [-1, 1]) {
        const edge = dir < 0 ? b.left : b.right;
        const headX = b.x0 + dir * Math.min(reach, Math.abs(edge - b.x0));
        if (Math.abs(headX - b.x0) < 0.5) continue;
        const x1 = Math.min(b.x0, headX), w = Math.abs(headX - b.x0);
        const g = ctx.createLinearGradient(b.x0, 0, headX, 0);
        g.addColorStop(0, `rgba(255,255,255,${0.15 * fade})`);
        g.addColorStop(1, `rgba(255,255,255,${0.9 * fade})`);
        ctx.fillStyle = g;
        ctx.fillRect(x1, b.y - h / 2, w, h);
        ctx.fillStyle = `rgba(255,255,220,${fade})`;
        ctx.fillRect(x1, b.y - h * 0.18, w, h * 0.36);
        ctx.beginPath();
        ctx.arc(headX, b.y, h * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
        ctx.fill();
      }
  }

  drawParticles(ctx) {
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
  }

  drawRest(ctx) {
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
      const scale = tx.kind === 'popup' ? 0.8 + 0.4 * Math.min(1, t * 4) : 0.6 + 0.7 * rise;
      const alpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
      ctx.save();
      ctx.translate(tx.x, tx.y - (tx.kind === 'popup' ? 34 : 50) * rise);
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
