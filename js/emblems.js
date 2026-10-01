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

// 아이콘 배경: 인물 색 바탕에 흰 아이콘을 비스듬한 격자 무늬로 깔아 얼굴에 가려져도 보이게
function iconBg(ctx, T, color, draw) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, T, T);
  const g = ctx.createLinearGradient(0, 0, 0, T);
  g.addColorStop(0, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, T, T);
  const n = parseInt(color.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  const ink = lum > 170 ? 'rgba(25,35,70,0.5)' : 'rgba(255,255,255,0.7)';
  const cell = T * 0.34;
  for (let r = -1; r < 4; r++) {
    for (let c = -1; c < 4; c++) {
      ctx.save();
      ctx.translate(c * cell + (r % 2 ? cell / 2 : 0), r * cell * 0.9);
      ctx.scale(cell / T, cell / T);
      ctx.fillStyle = ink;
      ctx.strokeStyle = ink;
      draw();
      ctx.restore();
    }
  }
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
  // 자동차
  car(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.save();
      ctx.translate(T / 2, T * 0.56);
      ctx.rotate(-0.12);
      const w = T * 0.92;
      ctx.beginPath();
      ctx.moveTo(-w / 2, T * 0.06);
      ctx.lineTo(-w / 2, -T * 0.04);
      ctx.quadraticCurveTo(-w * 0.42, -T * 0.1, -w * 0.25, -T * 0.11);
      ctx.quadraticCurveTo(-w * 0.12, -T * 0.27, w * 0.08, -T * 0.26);
      ctx.quadraticCurveTo(w * 0.25, -T * 0.25, w * 0.33, -T * 0.11);
      ctx.quadraticCurveTo(w * 0.5, -T * 0.08, w / 2, T * 0.02);
      ctx.lineTo(w / 2, T * 0.06);
      ctx.closePath();
      ctx.fill();
      for (const x of [-w * 0.28, w * 0.28]) { ctx.beginPath(); ctx.arc(x, T * 0.08, T * 0.1, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
  },
  // 미소 곡선 화살표
  smile(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.lineCap = 'round';
      ctx.lineWidth = T * 0.09;
      ctx.beginPath();
      ctx.moveTo(T * 0.12, T * 0.56);
      ctx.quadraticCurveTo(T * 0.48, T * 0.86, T * 0.84, T * 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(T * 0.9, T * 0.53);
      ctx.lineTo(T * 0.86, T * 0.73);
      ctx.lineTo(T * 0.7, T * 0.62);
      ctx.closePath();
      ctx.fill();
    });
  },
  // SNS 말풍선
  sns(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.beginPath();
      ctx.ellipse(T / 2, T * 0.44, T * 0.44, T * 0.3, 0, 0, Math.PI * 2);
      ctx.moveTo(T * 0.26, T * 0.66);
      ctx.lineTo(T * 0.14, T * 0.9);
      ctx.lineTo(T * 0.44, T * 0.72);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = `900 ${T * 0.26}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SNS', T / 2, T * 0.45);
    });
  },
};
