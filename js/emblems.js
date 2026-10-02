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

// 타일 위쪽에 작은 글씨 (ICBM, NUKE)
export function label(ctx, T, text) {
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.font = `900 ${T * 0.15}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = T * 0.04;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, T / 2, T * 0.14);
  ctx.fillStyle = '#FFE066';
  ctx.fillText(text, T / 2, T * 0.14);
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

  // ICBM: 짙은 남색 바탕에 위를 향한 미사일 + 위에 작은 'ICBM'
  missile(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const cx = T / 2;
      ctx.save();
      // 미사일을 조금 더 크고 통통하게
      ctx.translate(cx, T * 0.56);
      ctx.scale(1.4, 1.12);
      ctx.translate(-cx, -T * 0.56);
      // 불꽃
      ctx.save();
      ctx.shadowColor = 'rgba(255,140,0,0.8)';
      ctx.shadowBlur = T * 0.06;
      ctx.fillStyle = '#FFB000';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.07, T * 0.82);
      ctx.quadraticCurveTo(cx, T * 1.0, cx + T * 0.07, T * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#FF5A1F';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.04, T * 0.82);
      ctx.quadraticCurveTo(cx, T * 0.93, cx + T * 0.04, T * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // 꼬리 날개
      ctx.fillStyle = '#C8102E';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.08, T * 0.6); ctx.lineTo(cx - T * 0.17, T * 0.82); ctx.lineTo(cx - T * 0.08, T * 0.78);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + T * 0.08, T * 0.6); ctx.lineTo(cx + T * 0.17, T * 0.82); ctx.lineTo(cx + T * 0.08, T * 0.78);
      ctx.closePath(); ctx.fill();
      // 몸통
      const g = ctx.createLinearGradient(cx - T * 0.08, 0, cx + T * 0.08, 0);
      g.addColorStop(0, '#b9c1cc'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(1, '#8d97a5');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.08, T * 0.82);
      ctx.lineTo(cx - T * 0.08, T * 0.42);
      ctx.quadraticCurveTo(cx - T * 0.08, T * 0.3, cx, T * 0.24);
      ctx.quadraticCurveTo(cx + T * 0.08, T * 0.3, cx + T * 0.08, T * 0.42);
      ctx.lineTo(cx + T * 0.08, T * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      // 빨간 탄두 띠
      ctx.fillStyle = '#C8102E';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.075, T * 0.4);
      ctx.quadraticCurveTo(cx - T * 0.075, T * 0.3, cx, T * 0.24);
      ctx.quadraticCurveTo(cx + T * 0.075, T * 0.3, cx + T * 0.075, T * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1d2747';
      ctx.fillRect(cx - T * 0.08, T * 0.52, T * 0.16, T * 0.025);
      ctx.restore();
      label(ctx, T, 'ICBM');
    });
  },

  // 핵폭탄: 어두운 바탕에 버섯구름 + 위에 작은 'NUKE'
  nuke(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.shadowColor = 'transparent';
      const cx = T / 2;
      // 바닥 불덩이
      const ground = ctx.createRadialGradient(cx, T * 0.86, T * 0.02, cx, T * 0.86, T * 0.3);
      ground.addColorStop(0, '#FFF3B0'); ground.addColorStop(0.5, '#FF8A00'); ground.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = ground;
      ctx.beginPath(); ctx.ellipse(cx, T * 0.86, T * 0.32, T * 0.09, 0, 0, Math.PI * 2); ctx.fill();
      // 기둥
      const stem = ctx.createLinearGradient(0, T * 0.45, 0, T * 0.85);
      stem.addColorStop(0, '#FF7A00'); stem.addColorStop(1, '#FFD34D');
      ctx.fillStyle = stem;
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.06, T * 0.5);
      ctx.quadraticCurveTo(cx - T * 0.05, T * 0.7, cx - T * 0.12, T * 0.84);
      ctx.lineTo(cx + T * 0.12, T * 0.84);
      ctx.quadraticCurveTo(cx + T * 0.05, T * 0.7, cx + T * 0.06, T * 0.5);
      ctx.closePath();
      ctx.fill();
      // 고리 구름
      ctx.fillStyle = '#FF9A1F';
      ctx.beginPath(); ctx.ellipse(cx, T * 0.58, T * 0.16, T * 0.035, 0, 0, Math.PI * 2); ctx.fill();
      // 버섯 머리 (구름 덩이 여러 개)
      const cap = ctx.createRadialGradient(cx, T * 0.36, T * 0.03, cx, T * 0.42, T * 0.3);
      cap.addColorStop(0, '#FFF6C2'); cap.addColorStop(0.45, '#FFB21F'); cap.addColorStop(1, '#E2480C');
      ctx.fillStyle = cap;
      for (const [x, y, rr] of [[0, 0.4, 0.17], [-0.15, 0.44, 0.11], [0.15, 0.44, 0.11], [-0.09, 0.33, 0.11], [0.09, 0.33, 0.11], [0, 0.29, 0.1]]) {
        ctx.beginPath(); ctx.arc(cx + x * T, y * T, rr * T, 0, Math.PI * 2); ctx.fill();
      }
      label(ctx, T, 'NUKE');
    });
  },

  // 방사능 홍차 (푸틴): 남색 바탕에 김 나는 하얀 홍차잔, 잔에 노란 방사능 마크
  tea(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const cx = T * 0.46;
      // 받침 접시
      ctx.fillStyle = '#e9edf2';
      ctx.beginPath(); ctx.ellipse(cx + T * 0.03, T * 0.8, T * 0.34, T * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent';
      // 손잡이
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = T * 0.055;
      ctx.beginPath(); ctx.ellipse(cx + T * 0.27, T * 0.55, T * 0.085, T * 0.1, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      // 잔
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(cx - T * 0.27, T * 0.4);
      ctx.lineTo(cx + T * 0.27, T * 0.4);
      ctx.quadraticCurveTo(cx + T * 0.25, T * 0.78, cx, T * 0.78);
      ctx.quadraticCurveTo(cx - T * 0.25, T * 0.78, cx - T * 0.27, T * 0.4);
      ctx.closePath(); ctx.fill();
      // 홍차 수면
      ctx.fillStyle = '#B5651D';
      ctx.beginPath(); ctx.ellipse(cx, T * 0.4, T * 0.27, T * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      // 김 (초록빛이 살짝 도는 수상한 김)
      ctx.strokeStyle = 'rgba(170,255,140,0.85)';
      ctx.lineWidth = T * 0.03;
      ctx.lineCap = 'round';
      for (const dx of [-0.1, 0.02, 0.14]) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * T, T * 0.33);
        ctx.bezierCurveTo(cx + (dx - 0.06) * T, T * 0.26, cx + (dx + 0.06) * T, T * 0.2, cx + dx * T, T * 0.12);
        ctx.stroke();
      }
      // 방사능 마크
      const rx = cx, ry = T * 0.58, R = T * 0.13;
      ctx.fillStyle = '#FFD400';
      ctx.beginPath(); ctx.arc(rx, ry, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      for (let k = 0; k < 3; k++) {
        const a0 = -Math.PI / 2 + k * (Math.PI * 2 / 3) - Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.arc(rx, ry, R * 0.88, a0, a0 + Math.PI / 3);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#FFD400';
      ctx.beginPath(); ctx.arc(rx, ry, R * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(rx, ry, R * 0.18, 0, Math.PI * 2); ctx.fill();
    });
  },

  // 관세: 빨간 바탕에 초록 달러 뭉치 + 위에 작은 'TARIFF'
  tariff(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      const bill = (x, y, a) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        const w = T * 0.62, h = T * 0.3;
        ctx.fillStyle = '#4E9A4B';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = '#2E6B2C';
        ctx.lineWidth = T * 0.02;
        ctx.strokeRect(-w / 2 + T * 0.02, -h / 2 + T * 0.02, w - T * 0.04, h - T * 0.04);
        ctx.fillStyle = '#CDE8C4';
        ctx.beginPath(); ctx.ellipse(0, 0, h * 0.34, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1F5A1D';
        ctx.font = `900 ${h * 0.6}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', 0, h * 0.04);
        ctx.restore();
      };
      bill(T * 0.5, T * 0.72, -0.12);
      bill(T * 0.5, T * 0.6, 0.08);
      bill(T * 0.5, T * 0.48, -0.04);
      // 띠지
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#F4E3B2';
      ctx.save(); ctx.translate(T * 0.5, T * 0.48); ctx.rotate(-0.04);
      ctx.fillRect(-T * 0.05, -T * 0.15, T * 0.1, T * 0.3);
      ctx.restore();
      label(ctx, T, 'TARIFF');
    });
  },

  // 카이주: 불타는 도시 하늘 바탕에 고질라 같은 초록 괴수 + 위에 작은 'KAIJU'
  kaiju(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.shadowColor = 'transparent';
      // 도시 실루엣
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (const [x, w, h] of [[0.05, 0.12, 0.22], [0.2, 0.1, 0.32], [0.72, 0.12, 0.28], [0.86, 0.1, 0.2]]) ctx.fillRect(x * T, (0.92 - h) * T, w * T, h * T);
      drawKaijuShape(ctx, T * 0.5, T * 0.6, T * 0.78, 0);
      label(ctx, T, 'KAIJU');
    });
  },

  // UFO: 보라 밤하늘에 비행접시 + 위에 작은 'ALIEN'
  ufo(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [x, y, r] of [[0.15, 0.3, 0.012], [0.85, 0.36, 0.01], [0.78, 0.85, 0.012], [0.2, 0.82, 0.01]]) { ctx.beginPath(); ctx.arc(x * T, y * T, r * T, 0, Math.PI * 2); ctx.fill(); }
      drawUfoShape(ctx, T / 2, T * 0.58, T * 0.82, 0);
      label(ctx, T, 'ALIEN');
    });
  },

  // 기밀 파일: 짙은 바탕에 마닐라 서류철 + 빨간 TOP SECRET 도장 + 위에 작은 'SECRETS'
  secrets(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      // 서류철 뒷장 + 탭
      ctx.fillStyle = '#C9A24E';
      ctx.beginPath();
      ctx.moveTo(T * 0.16, T * 0.34); ctx.lineTo(T * 0.4, T * 0.34); ctx.lineTo(T * 0.45, T * 0.29); ctx.lineTo(T * 0.84, T * 0.29);
      ctx.lineTo(T * 0.84, T * 0.82); ctx.lineTo(T * 0.16, T * 0.82); ctx.closePath(); ctx.fill();
      ctx.shadowColor = 'transparent';
      // 삐져나온 서류
      ctx.fillStyle = '#ffffff';
      ctx.save(); ctx.translate(T * 0.52, T * 0.5); ctx.rotate(-0.08); ctx.fillRect(-T * 0.28, -T * 0.16, T * 0.56, T * 0.3); ctx.restore();
      ctx.strokeStyle = '#9aa3ad'; ctx.lineWidth = T * 0.012;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(T * 0.3, T * (0.42 + i * 0.05)); ctx.lineTo(T * 0.7, T * (0.39 + i * 0.05)); ctx.stroke(); }
      // 앞장
      ctx.fillStyle = '#E2BC63';
      ctx.fillRect(T * 0.16, T * 0.52, T * 0.68, T * 0.3);
      // TOP SECRET 도장
      ctx.save();
      ctx.translate(T * 0.5, T * 0.67); ctx.rotate(-0.14);
      ctx.strokeStyle = '#C4161C'; ctx.lineWidth = T * 0.022;
      ctx.strokeRect(-T * 0.27, -T * 0.075, T * 0.54, T * 0.15);
      ctx.fillStyle = '#C4161C';
      ctx.font = `900 ${T * 0.09}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TOP SECRET', 0, T * 0.005);
      ctx.restore();
      label(ctx, T, 'SECRETS');
    });
  },

  // 드론 (그림 파일이 없을 때 대신 그리는 것)
  drone(ctx, T, color) {
    iconBg(ctx, T, color, () => {
      drawDroneShape(ctx, T / 2, T * 0.56, T * 0.8, 0);
      label(ctx, T, 'DRONE');
    });
  },
};

// 드론 모양 (가운데 cx, cy, 폭 w, 프로펠러 각도 spin) — 타일 그림과 날아가는 연출에서 같이 씀
export function drawDroneShape(ctx, cx, cy, w, spin) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = w / 100;
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = '#1d2747';
  // 팔
  ctx.strokeStyle = '#e8ecf2';
  ctx.lineWidth = 7 * s;
  ctx.beginPath();
  ctx.moveTo(-38 * s, -14 * s); ctx.lineTo(38 * s, 14 * s);
  ctx.moveTo(38 * s, -14 * s); ctx.lineTo(-38 * s, 14 * s);
  ctx.stroke();
  // 프로펠러 (돌아가는 흐린 원 + 날개)
  for (const [x, y] of [[-40, -16], [40, -16], [-40, 16], [40, 16]]) {
    ctx.fillStyle = 'rgba(40,45,60,0.25)';
    ctx.beginPath(); ctx.ellipse(x * s, (y - 7) * s, 20 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    const a = spin + (x + y) * 0.1;
    ctx.moveTo((x - Math.cos(a) * 18) * s, (y - 7 - Math.sin(a) * 4) * s);
    ctx.lineTo((x + Math.cos(a) * 18) * s, (y - 7 + Math.sin(a) * 4) * s);
    ctx.stroke();
    ctx.fillStyle = '#2b2f3a';
    ctx.beginPath(); ctx.arc(x * s, (y - 4) * s, 4 * s, 0, Math.PI * 2); ctx.fill();
  }
  // 몸통
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1d2747';
  ctx.lineWidth = 3 * s;
  ctx.beginPath(); ctx.ellipse(0, 0, 24 * s, 17 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 눈
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-8 * s, -2 * s, 3.5 * s, 0, Math.PI * 2); ctx.arc(8 * s, -2 * s, 3.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// UFO 모양 (가운데 cx, cy, 폭 w, 불빛 회전 spin)
export function drawUfoShape(ctx, cx, cy, w, spin) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = w / 100;
  // 빔
  ctx.fillStyle = 'rgba(160,255,170,0.18)';
  ctx.beginPath(); ctx.moveTo(-14 * s, 8 * s); ctx.lineTo(14 * s, 8 * s); ctx.lineTo(26 * s, 34 * s); ctx.lineTo(-26 * s, 34 * s); ctx.closePath(); ctx.fill();
  // 돔 + 외계인
  const dome = ctx.createRadialGradient(-6 * s, -18 * s, 2 * s, 0, -10 * s, 22 * s);
  dome.addColorStop(0, 'rgba(220,255,255,0.95)'); dome.addColorStop(1, 'rgba(90,200,230,0.85)');
  ctx.fillStyle = dome;
  ctx.beginPath(); ctx.ellipse(0, -8 * s, 20 * s, 18 * s, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#5BD06A';
  ctx.beginPath(); ctx.ellipse(0, -12 * s, 7 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(-3 * s, -13 * s, 2.2 * s, 3 * s, -0.3, 0, Math.PI * 2); ctx.ellipse(3 * s, -13 * s, 2.2 * s, 3 * s, 0.3, 0, Math.PI * 2); ctx.fill();
  // 접시
  const disc = ctx.createLinearGradient(0, -8 * s, 0, 10 * s);
  disc.addColorStop(0, '#e6e9ef'); disc.addColorStop(1, '#8a92a3');
  ctx.fillStyle = disc;
  ctx.strokeStyle = '#2b2f3a';
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.ellipse(0, 0, 46 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 돌아가는 불빛
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * Math.PI) / 3;
    const x = Math.cos(a) * 36 * s, y = Math.sin(a) * 6 * s + 2 * s;
    if (Math.sin(a) < -0.2) continue; // 뒤쪽은 안 보임
    ctx.fillStyle = i % 2 ? '#FFD84A' : '#FF5A5A';
    ctx.beginPath(); ctx.arc(x, y, 3.6 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 카이주 모양 (가운데 cx, cy, 크기 w, 입 벌림 roar 0~1)
export function drawKaijuShape(ctx, cx, cy, w, roar) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = w / 100;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#13240f';
  ctx.lineWidth = 3 * s;
  // 꼬리
  ctx.fillStyle = '#4C8A3A';
  ctx.beginPath();
  ctx.moveTo(-10 * s, 22 * s);
  ctx.quadraticCurveTo(-40 * s, 34 * s, -46 * s, 18 * s);
  ctx.quadraticCurveTo(-34 * s, 24 * s, -12 * s, 10 * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // 등 가시 (하얀빛 도는 판)
  ctx.fillStyle = '#C9E7B8';
  for (const [x, y, h] of [[-14, -14, 14], [-20, -2, 12], [-24, 10, 10], [-8, -26, 12]]) {
    ctx.beginPath(); ctx.moveTo((x - 5) * s, y * s); ctx.lineTo((x - 9) * s, (y - h) * s); ctx.lineTo((x + 4) * s, (y - 2) * s); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // 몸통
  ctx.fillStyle = '#5DA046';
  ctx.beginPath(); ctx.ellipse(0, 10 * s, 22 * s, 26 * s, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 배
  ctx.fillStyle = '#B9D98A';
  ctx.beginPath(); ctx.ellipse(6 * s, 14 * s, 11 * s, 18 * s, 0.1, 0, Math.PI * 2); ctx.fill();
  // 다리
  ctx.fillStyle = '#5DA046';
  ctx.beginPath(); ctx.ellipse(-8 * s, 36 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); ctx.ellipse(12 * s, 36 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 팔
  ctx.beginPath(); ctx.ellipse(20 * s, 6 * s, 9 * s, 4.5 * s, -0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 머리
  ctx.beginPath(); ctx.ellipse(12 * s, -24 * s, 17 * s, 12 * s, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // 입 (roar면 크게 벌림)
  const open = 3 + roar * 9;
  ctx.fillStyle = '#7a1414';
  ctx.beginPath(); ctx.ellipse(22 * s, -18 * s, 9 * s, open * s * 0.6, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const x of [16, 20, 24, 28]) { ctx.beginPath(); ctx.moveTo(x * s, (-18 - open * 0.5) * s); ctx.lineTo((x + 1.5) * s, (-18 - open * 0.5 + 3) * s); ctx.lineTo((x + 3) * s, (-18 - open * 0.5) * s); ctx.fill(); }
  // 눈 (화난 눈썹)
  ctx.fillStyle = '#FFE14A';
  ctx.beginPath(); ctx.ellipse(10 * s, -28 * s, 4 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(11 * s, -28 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#13240f'; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(5 * s, -33 * s); ctx.lineTo(15 * s, -30 * s); ctx.stroke();
  ctx.restore();
}
