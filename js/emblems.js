// 특수 타일 배경 그림(국기·아이콘)을 코드로 그린다. 좌표는 T×T 정사각.
// characters.json의 "emblem" 값으로 고른다. assets/special/<id>.png 가 있으면 그 그림이 대신 쓰인다.

function star(ctx, cx, cy, r, color) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// 아이콘 배경: 인물 색 바탕 + 위쪽 빛 + 큰 아이콘 하나 (밝은 배경이면 어두운 잉크)
function iconBg(ctx, T, color, draw) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, T, T);
  const g = ctx.createLinearGradient(0, 0, 0, T);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, T, T);
  const n = parseInt(color.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  const ink = lum > 170 ? '#1d2747' : '#ffffff';
  ctx.save();
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = T * 0.04;
  ctx.shadowOffsetY = T * 0.02;
  draw(ink, lum > 170 ? color : '#1d2747');
  ctx.restore();
}

export const EMBLEMS = {
  // 성조기
  us(ctx, T) {
    const h = T / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#B22234';
      ctx.fillRect(0, i * h, T, h + 0.5);
    }
    ctx.fillStyle = '#3C3B6E';
    ctx.fillRect(0, 0, T * 0.48, h * 7);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        star(ctx, T * 0.06 + c * T * 0.12 + (r % 2) * T * 0.03, h * 0.9 + r * h * 1.6, T * 0.035, '#ffffff');
      }
    }
  },
  // 인공기
  nk(ctx, T) {
    ctx.fillStyle = '#024FA2';
    ctx.fillRect(0, 0, T, T);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, T * 0.18, T, T * 0.64);
    ctx.fillStyle = '#ED1C27';
    ctx.fillRect(0, T * 0.22, T, T * 0.56);
    ctx.beginPath();
    ctx.arc(T * 0.32, T * 0.5, T * 0.19, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    star(ctx, T * 0.32, T * 0.51, T * 0.17, '#ED1C27');
  },
  // 러시아 국기
  ru(ctx, T) {
    ['#ffffff', '#0039A6', '#D52B1E'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (i * T) / 3, T, T / 3 + 0.5);
    });
  },
  // 사이버트럭: 각진 삼각 지붕 실루엣
  car(ctx, T, color) {
    iconBg(ctx, T, color, (ink, hole) => {
      const y = T * 0.62;
      ctx.beginPath();
      ctx.moveTo(T * 0.06, y);
      ctx.lineTo(T * 0.08, T * 0.5);
      ctx.lineTo(T * 0.5, T * 0.3);     // 지붕 꼭짓점
      ctx.lineTo(T * 0.94, T * 0.47);
      ctx.lineTo(T * 0.95, y);
      ctx.closePath();
      ctx.fill();
      // 창문 띠
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.moveTo(T * 0.3, T * 0.43);
      ctx.lineTo(T * 0.5, T * 0.34);
      ctx.lineTo(T * 0.68, T * 0.41);
      ctx.lineTo(T * 0.66, T * 0.45);
      ctx.lineTo(T * 0.32, T * 0.46);
      ctx.closePath();
      ctx.fill();
      // 바퀴 (각진 휠 아치 + 바퀴)
      for (const x of [T * 0.27, T * 0.75]) {
        ctx.fillStyle = hole;
        ctx.beginPath();
        ctx.moveTo(x - T * 0.13, y + 0.5);
        ctx.lineTo(x - T * 0.08, T * 0.52);
        ctx.lineTo(x + T * 0.08, T * 0.52);
        ctx.lineTo(x + T * 0.13, y + 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = ink;
        ctx.beginPath();
        ctx.arc(x, T * 0.62, T * 0.085, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hole;
        ctx.beginPath();
        ctx.arc(x, T * 0.62, T * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      // 앞쪽 라이트 줄
      ctx.fillStyle = hole;
      ctx.fillRect(T * 0.78, T * 0.48, T * 0.15, T * 0.015);
    });
  },
  // 우주선: 비스듬히 솟는 로켓 + 불꽃
  rocket(ctx, T, color) {
    iconBg(ctx, T, color, (ink, hole) => {
      ctx.save();
      ctx.translate(T * 0.52, T * 0.5);
      ctx.rotate(Math.PI / 5);
      const L = T * 0.62, W = T * 0.2;
      // 불꽃
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FF6B2C';
      ctx.beginPath();
      ctx.moveTo(-W * 0.38, L * 0.38);
      ctx.quadraticCurveTo(0, L * 0.95, W * 0.38, L * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FFE14D';
      ctx.beginPath();
      ctx.moveTo(-W * 0.2, L * 0.38);
      ctx.quadraticCurveTo(0, L * 0.72, W * 0.2, L * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // 동체 (둥근 머리)
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.moveTo(-W / 2, L * 0.4);
      ctx.lineTo(-W / 2, -L * 0.15);
      ctx.quadraticCurveTo(-W / 2, -L * 0.5, 0, -L * 0.55);
      ctx.quadraticCurveTo(W / 2, -L * 0.5, W / 2, -L * 0.15);
      ctx.lineTo(W / 2, L * 0.4);
      ctx.closePath();
      ctx.fill();
      // 날개
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sgn * W / 2, L * 0.1);
        ctx.lineTo(sgn * W * 1.05, L * 0.42);
        ctx.lineTo(sgn * W / 2, L * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      // 창문
      ctx.fillStyle = hole;
      ctx.beginPath();
      ctx.arc(0, -L * 0.18, W * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // 별
      ctx.shadowBlur = 0;
      for (const [x, y, r] of [[0.16, 0.2, 0.03], [0.82, 0.78, 0.025], [0.18, 0.78, 0.02], [0.85, 0.2, 0.02]]) {
        star(ctx, T * x, T * y, T * r, ink);
      }
    });
  },
  // SNS 말풍선
  sns(ctx, T, color) {
    iconBg(ctx, T, color, (ink, hole) => {
      ctx.beginPath();
      ctx.ellipse(T / 2, T * 0.44, T * 0.44, T * 0.3, 0, 0, Math.PI * 2);
      ctx.moveTo(T * 0.26, T * 0.66);
      ctx.lineTo(T * 0.14, T * 0.9);
      ctx.lineTo(T * 0.44, T * 0.72);
      ctx.fill();
      ctx.fillStyle = hole;
      ctx.font = `900 ${T * 0.26}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'transparent';
      ctx.fillText('SNS', T / 2, T * 0.45);
    });
  },
};
