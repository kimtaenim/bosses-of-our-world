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
  // 인도 국기
  in(ctx, T) {
    ['#FF9933', '#ffffff', '#138808'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (i * T) / 3, T, T / 3 + 0.5);
    });
    // 아쇼카 차크라 (24살 바퀴)
    const cx = T / 2, cy = T / 2, R = T * 0.13;
    ctx.strokeStyle = '#000080';
    ctx.lineWidth = T * 0.022;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = T * 0.008;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.fillStyle = '#000080';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
  },
  // 석유 방울: 금빛 방울 + 하이라이트
  oil(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const cx = T / 2;
      const g = ctx.createLinearGradient(0, T * 0.15, 0, T * 0.85);
      g.addColorStop(0, '#FFF1A8');
      g.addColorStop(0.5, '#FFC93C');
      g.addColorStop(1, '#B8770F');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, T * 0.14);
      ctx.bezierCurveTo(cx + T * 0.06, T * 0.3, cx + T * 0.27, T * 0.45, cx + T * 0.27, T * 0.6);
      ctx.arc(cx, T * 0.6, T * 0.27, 0, Math.PI);
      ctx.bezierCurveTo(cx - T * 0.27, T * 0.45, cx - T * 0.06, T * 0.3, cx, T * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = T * 0.025;
      ctx.strokeStyle = '#6b4204';
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx - T * 0.1, T * 0.6, T * 0.045, T * 0.09, -0.3, 0, Math.PI * 2);
      ctx.fill();
    });
  },
  // AI 로봇 머리: 안테나 + 네모 머리 + 빛나는 눈 + 입 격자
  robot(ctx, T, color) {
    iconBg(ctx, T, color, (ink, hole) => {
      const x = T * 0.22, y = T * 0.32, w = T * 0.56, h = T * 0.48, r = T * 0.1;
      // 안테나
      ctx.fillRect(T * 0.485, T * 0.16, T * 0.03, T * 0.17);
      ctx.beginPath();
      ctx.arc(T * 0.5, T * 0.15, T * 0.055, 0, Math.PI * 2);
      ctx.fill();
      // 귀
      ctx.fillRect(T * 0.14, T * 0.48, T * 0.09, T * 0.16);
      ctx.fillRect(T * 0.77, T * 0.48, T * 0.09, T * 0.16);
      // 머리
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
      // 빛나는 눈
      ctx.shadowColor = '#7DF9FF';
      ctx.shadowBlur = T * 0.06;
      ctx.fillStyle = '#7DF9FF';
      for (const ex of [0.38, 0.62]) {
        ctx.beginPath();
        ctx.arc(T * ex, T * 0.5, T * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
      // 입 격자
      ctx.shadowBlur = 0;
      ctx.fillStyle = hole;
      ctx.fillRect(T * 0.34, T * 0.65, T * 0.32, T * 0.07);
      ctx.fillStyle = ink;
      for (const mx of [0.42, 0.5, 0.58]) ctx.fillRect(T * mx - T * 0.008, T * 0.65, T * 0.016, T * 0.07);
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

  // 지구: 파란 바탕에 하얀 지도 (경선·위선 + 대륙)
  globe(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const cx = T / 2, cy = T / 2, R = T * 0.32;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.clip();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      // 대륙 (아메리카 · 유라시아 · 아프리카 느낌의 덩어리)
      const blob = (pts) => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * R, cy + y * R) : ctx.moveTo(cx + x * R, cy + y * R)));
        ctx.closePath();
        ctx.fill();
      };
      blob([[-0.85, -0.55], [-0.45, -0.75], [-0.3, -0.45], [-0.5, -0.15], [-0.35, 0.05], [-0.45, 0.35], [-0.6, 0.75], [-0.75, 0.4], [-0.9, 0.0]]);
      blob([[0.0, -0.8], [0.5, -0.75], [0.9, -0.45], [0.75, -0.2], [0.45, -0.15], [0.25, -0.3], [0.05, -0.35]]);
      blob([[0.05, -0.15], [0.4, -0.05], [0.45, 0.3], [0.25, 0.75], [0.1, 0.55], [-0.05, 0.15]]);
      blob([[0.6, 0.35], [0.85, 0.4], [0.8, 0.6], [0.6, 0.55]]);
      // 경선·위선
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = T * 0.015;
      for (const k of [0.45, 0.85]) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, R * k, R, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const y of [-0.5, 0, 0.5]) {
        const w = Math.sqrt(1 - y * y) * R;
        ctx.beginPath();
        ctx.moveTo(cx - w, cy + y * R);
        ctx.lineTo(cx + w, cy + y * R);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.lineWidth = T * 0.035;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });
  },

  // 시한폭탄: 검은 동그라미 + 디지털 창 (숫자는 게임이 매 프레임 그 위에 그림)
  timebomb(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const cx = T / 2, cy = T * 0.54, R = T * 0.3;
      // 심지
      ctx.strokeStyle = '#c8a46a';
      ctx.lineWidth = T * 0.04;
      ctx.beginPath();
      ctx.moveTo(cx + R * 0.5, cy - R * 0.85);
      ctx.quadraticCurveTo(cx + R * 0.9, cy - R * 1.35, cx + R * 1.2, cy - R * 1.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, '#5a5f6e');
      g.addColorStop(1, '#0b0c10');
      ctx.fillStyle = g;
      ctx.fill();
      // 디지털 창
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(cx - R * 0.48, cy - R * 0.58, R * 0.96, R * 1.16);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = T * 0.015;
      ctx.strokeRect(cx - R * 0.48, cy - R * 0.58, R * 0.96, R * 1.16);
    });
  },

  // 평화의 비둘기: 하늘색 바탕에 하얀 비둘기가 초록 올리브 가지를 물고 있음
  dove(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const P = (x, y) => [T * x, T * y];
      // 타일을 꽉 채우게 1.15배 (올리브 가지가 잘리지 않게 살짝 왼쪽으로)
      ctx.translate(T * 0.44, T * 0.5);
      ctx.scale(1.15, 1.15);
      ctx.translate(-T / 2, -T / 2);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(40,70,110,0.55)';
      ctx.lineWidth = T * 0.012;
      ctx.lineJoin = 'round';
      // 몸통 + 꼬리 (오른쪽을 보고 날아가는 모습)
      ctx.beginPath();
      ctx.moveTo(...P(0.68, 0.40));                                   // 머리 뒤
      ctx.bezierCurveTo(...P(0.62, 0.58), ...P(0.45, 0.66), ...P(0.30, 0.64));
      ctx.lineTo(...P(0.12, 0.74));                                   // 꼬리 끝 아래
      ctx.lineTo(...P(0.16, 0.62));
      ctx.lineTo(...P(0.10, 0.56));                                   // 꼬리 끝 위
      ctx.bezierCurveTo(...P(0.28, 0.54), ...P(0.40, 0.50), ...P(0.50, 0.44));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 위로 든 날개
      ctx.beginPath();
      ctx.moveTo(...P(0.50, 0.46));
      ctx.bezierCurveTo(...P(0.40, 0.30), ...P(0.28, 0.20), ...P(0.18, 0.18));
      ctx.bezierCurveTo(...P(0.26, 0.26), ...P(0.24, 0.30), ...P(0.30, 0.34));
      ctx.bezierCurveTo(...P(0.26, 0.36), ...P(0.30, 0.42), ...P(0.38, 0.44));
      ctx.bezierCurveTo(...P(0.36, 0.48), ...P(0.44, 0.52), ...P(0.56, 0.50));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 머리
      ctx.beginPath();
      ctx.arc(...P(0.70, 0.36), T * 0.085, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      // 부리
      ctx.fillStyle = '#F2A33A';
      ctx.beginPath();
      ctx.moveTo(...P(0.77, 0.33));
      ctx.lineTo(...P(0.86, 0.36));
      ctx.lineTo(...P(0.77, 0.39));
      ctx.closePath();
      ctx.fill();
      // 눈
      ctx.fillStyle = '#1d2747';
      ctx.beginPath();
      ctx.arc(...P(0.72, 0.34), T * 0.016, 0, Math.PI * 2);
      ctx.fill();
      // 입에 문 초록 올리브 가지
      ctx.strokeStyle = '#3d8b37';
      ctx.lineWidth = T * 0.028;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(...P(0.82, 0.37));
      ctx.quadraticCurveTo(...P(0.88, 0.46), ...P(0.86, 0.56));
      ctx.stroke();
      ctx.fillStyle = '#56b04a';
      for (const [x, y, a] of [[0.85, 0.42, -0.6], [0.89, 0.47, 0.5], [0.84, 0.50, -0.7], [0.88, 0.55, 0.6], [0.86, 0.58, 0]]) {
        ctx.save();
        ctx.translate(...P(x, y));
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, T * 0.052, T * 0.024, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  },
};
