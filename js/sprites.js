// 인물 타일 스프라이트. 표정별 얼굴 이미지가 없으면 코드로 그린 플레이스홀더 얼굴을 쓴다.
// 스프라이트는 화면 해상도에 맞춰 오프스크린 캔버스로 미리 렌더링해 둔다.
//
// 얼굴 이미지 경로: <faceDir><표정>.png  (예: assets/faces/trump/stern.png)
// 기본 표정(stern)이 없으면 그 인물은 전부 플레이스홀더. 일부 표정만 있으면
// 빠진 표정은 expressionFallback을 따라 있는 이미지로 대체한다.
// 원화는 절대 좌우 반전하지 않는다(가르마·앞머리 방향이 뒤집히므로).
// 오른쪽 곁눈질은 glance, 왼쪽은 glance_left 그림을 따로 쓰고, glance_left가 없으면 eyeroll로 대체.
// 플레이스홀더 얼굴은 좌우 대칭이라 glance_left를 glance 반전으로 그린다.

export const DEFAULT_EXPRESSIONS = [
  'stern', 'eyeroll', 'shock', 'scream', 'fall', 'smug',
  'blink', 'glance', 'glance_left', 'nervous', 'squish', 'sulk', 'cheer',
];

export const DEFAULT_FALLBACK = {
  eyeroll: 'stern', shock: 'stern', scream: 'shock', fall: 'shock', smug: 'stern',
  blink: 'stern', glance: 'eyeroll', glance_left: 'eyeroll', nervous: 'stern', squish: 'scream', sulk: 'stern', cheer: 'smug',
};

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 밝은 배경색이면 선·글자를 어둡게
function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186 ? '#1a1a1a' : '#ffffff';
}

const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

// ---------- 플레이스홀더 얼굴 (56×56 논리 좌표) ----------

const EYE_L = 19, EYE_R = 37, EYE_Y = 27;
const PUPIL = '#141414';

function drawPlaceholderFace(ctx, expr, bg, fg) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts, w = 2.4, color = fg) => {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  // 흰자 + 눈동자. lidTop/lidBottom: 눈꺼풀이 덮는 비율(0~1)
  const eye = (x, y, r, px = 0, py = 0, pr = r * 0.48, lidTop = 0, lidBottom = 0) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.arc(x + px, y + py, pr, 0, Math.PI * 2);
    ctx.fillStyle = PUPIL;
    ctx.fill();
    ctx.fillStyle = bg;
    if (lidTop > 0) ctx.fillRect(x - r - 1, y - r - 1, r * 2 + 2, r * 2 * lidTop + 1);
    if (lidBottom > 0) ctx.fillRect(x - r - 1, y + r - r * 2 * lidBottom, r * 2 + 2, r * 2 * lidBottom + 1);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (lidTop > 0) line([x - r, y - r + r * 2 * lidTop, x + r, y - r + r * 2 * lidTop], 2);
    if (lidBottom > 0) line([x - r, y + r - r * 2 * lidBottom, x + r, y + r - r * 2 * lidBottom], 2);
  };
  const mouthFill = (fn, fill = '#3a0d0d') => {
    ctx.beginPath();
    fn();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 2;
    ctx.stroke();
  };
  const both = (fn) => { fn(EYE_L, -1); fn(EYE_R, 1); };

  switch (expr) {
    case 'stern': // 근엄: 찌푸린 눈썹, 반쯤 내린 눈꺼풀, 굳게 다문 입
      line([12, 17, 24, 21]); line([44, 17, 32, 21]);
      both((x) => eye(x, EYE_Y, 5.5, 0, 1.2, 2.6, 0.3));
      line([21, 43, 24, 41, 32, 41, 35, 43]);
      break;
    case 'eyeroll': // 눈동자 굴리기: 위로 치켜뜬 눈, 비뚤어진 입
      line([12, 15, 23, 14]); line([33, 14, 44, 15]);
      both((x) => eye(x, EYE_Y, 5.8, 0.5, -3.6, 2.6, 0, 0.3));
      line([24, 42, 30, 41, 37, 39]);
      break;
    case 'blink': // 눈 깜빡
      line([12, 18, 23, 19]); line([33, 19, 44, 18]);
      both((x) => line([x - 5, EYE_Y + 1, x, EYE_Y + 2.5, x + 5, EYE_Y + 1], 2.4));
      line([22, 42, 34, 42]);
      break;
    case 'glance': // 곁눈질 (오른쪽)
      line([12, 18, 23, 18]); line([33, 14, 44, 16]);
      both((x) => eye(x, EYE_Y, 5.5, 3, 0.5, 2.6, 0.2));
      line([24, 42, 31, 42, 36, 40]);
      break;
    case 'nervous': // 긴장: 작은 눈동자, 걱정 눈썹, 땀, 물결 입
      line([12, 19, 23, 15]); line([44, 19, 33, 15]);
      both((x) => eye(x, EYE_Y, 5.8, 0, 0, 1.7));
      line([20, 43, 23, 40, 26, 43, 29, 40, 32, 43, 35, 40], 2);
      ctx.beginPath(); // 땀방울
      ctx.moveTo(47, 12);
      ctx.quadraticCurveTo(51, 19, 47, 21);
      ctx.quadraticCurveTo(43, 19, 47, 12);
      ctx.fillStyle = '#7fd4ff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'shock': // 깜짝 놀람: 튀어나온 눈, O 입
      line([11, 14, 23, 13]); line([33, 13, 45, 14]);
      both((x) => eye(x, EYE_Y - 1, 8.2, 0, 0, 2));
      mouthFill(() => ctx.ellipse(28, 44, 4.5, 6, 0, 0, Math.PI * 2));
      break;
    case 'scream': // 비명: X 눈, 크게 벌린 입
      line([11, 16, 23, 13]); line([33, 13, 45, 16]);
      both((x) => { line([x - 4.5, EYE_Y - 4.5, x + 4.5, EYE_Y + 4.5], 3); line([x + 4.5, EYE_Y - 4.5, x - 4.5, EYE_Y + 4.5], 3); });
      mouthFill(() => ctx.ellipse(28, 43, 9, 8, 0, 0, Math.PI * 2));
      ctx.beginPath();
      ctx.ellipse(28, 48, 5, 2.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e8546a';
      ctx.fill();
      break;
    case 'fall': // 떨어지는 중: 겁먹은 눈썹, 위를 보는 눈, "으아" 입
      line([12, 17, 23, 13]); line([44, 17, 33, 13]);
      both((x) => eye(x, EYE_Y, 6.6, 0, -2.2, 2));
      mouthFill(() => { ctx.moveTo(20, 39); ctx.quadraticCurveTo(28, 36, 36, 39); ctx.quadraticCurveTo(35, 49, 28, 49); ctx.quadraticCurveTo(21, 49, 20, 39); });
      break;
    case 'squish': // 찌그러짐: > < 눈, 앙다문 지그재그 입
      line([12, 18, 23, 21]); line([44, 18, 33, 21]);
      line([EYE_L - 4, EYE_Y - 4, EYE_L + 3, EYE_Y, EYE_L - 4, EYE_Y + 4], 2.8);
      line([EYE_R + 4, EYE_Y - 4, EYE_R - 3, EYE_Y, EYE_R + 4, EYE_Y + 4], 2.8);
      line([20, 42, 24, 40, 28, 42, 32, 40, 36, 42], 2.2);
      break;
    case 'sulk': // 삐짐: 처진 눈썹, 내리깐 눈, 삐죽 내민 입
      line([12, 20, 23, 17]); line([44, 20, 33, 17]);
      both((x) => eye(x, EYE_Y + 1, 5.3, 0, 2, 2.4, 0.45));
      ctx.beginPath();
      ctx.ellipse(30, 43, 3.4, 2.8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      break;
    case 'smug': // 의기양양: 한쪽 눈썹 치켜올림, 게슴츠레한 눈, 씩 웃음
      line([12, 19, 23, 19]); line([33, 16, 44, 13]);
      both((x) => eye(x, EYE_Y, 5.5, 1.5, 1, 2.6, 0.5));
      ctx.beginPath();
      ctx.moveTo(19, 40);
      ctx.quadraticCurveTo(28, 47, 38, 36);
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2.6;
      ctx.stroke();
      break;
    case 'cheer': // 환호: ^ ^ 눈, 활짝 웃는 입
      line([12, 15, 23, 13]); line([33, 13, 44, 15]);
      both((x) => line([x - 5, EYE_Y + 2, x, EYE_Y - 3, x + 5, EYE_Y + 2], 2.8));
      mouthFill(() => { ctx.moveTo(18, 37); ctx.lineTo(38, 37); ctx.arc(28, 37, 10, 0, Math.PI); ctx.closePath(); });
      ctx.beginPath();
      ctx.ellipse(28, 44, 4.5, 2.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#e8546a';
      ctx.fill();
      break;
    default:
      break;
  }
}

export class Sprites {
  constructor(characters, tile, expressions = DEFAULT_EXPRESSIONS, fallback = DEFAULT_FALLBACK) {
    this.characters = characters;
    this.tile = tile;
    this.expressions = expressions;
    this.fallback = fallback;
    this.faceImgs = [];   // [charIdx] → { expr: Image } | null
    this.specialImgs = [];
    this.normal = [];     // [charIdx] → { expr: canvas }
    this.special = [];
    this.pxScale = 0;
  }

  async load() {
    this.faceImgs = await Promise.all(this.characters.map((ch) => this.loadFaces(ch)));
    this.specialImgs = await Promise.all(this.characters.map((ch) => loadImage(ch.special)));
  }

  async loadFaces(ch) {
    if (!ch.faceDir) return null;
    const base = await loadImage(`${ch.faceDir}stern.png`);
    if (!base) return null;
    const imgs = { stern: base };
    const rest = this.expressions.filter((e) => e !== 'stern');
    const loaded = await Promise.all(rest.map((e) => loadImage(`${ch.faceDir}${e}.png`)));
    rest.forEach((e, i) => { if (loaded[i]) imgs[e] = loaded[i]; });
    return imgs;
  }

  // 없는 표정은 대체 표정을 따라감
  resolveImage(imgs, expr) {
    let e = expr;
    for (let guard = 0; guard < 6 && e; guard++) {
      if (imgs[e]) return imgs[e];
      e = this.fallback[e];
    }
    return imgs.stern;
  }

  // pxScale = 논리 px → 실제 픽셀 배율 (보드 스케일 × devicePixelRatio)
  build(pxScale) {
    if (Math.abs(pxScale - this.pxScale) < 0.01) return;
    this.pxScale = pxScale;
    this.normal = this.characters.map((ch, i) => {
      const set = {};
      for (const e of this.expressions) set[e] = this.renderFace(ch, i, e);
      return set;
    });
    this.special = this.characters.map((ch, i) => this.renderSpecial(ch, i));
  }

  canvas() {
    const T = this.tile;
    const size = Math.max(8, Math.ceil(T * this.pxScale));
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.scale(size / T, size / T);
    return [cv, ctx];
  }

  renderFace(ch, i, expr) {
    const T = this.tile;
    const [cv, ctx] = this.canvas();
    const color = ch.color;
    const fg = textColorFor(color);
    ctx.beginPath();
    ctx.arc(T / 2, T / 2, T / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    const imgs = this.faceImgs[i];
    if (imgs) {
      ctx.drawImage(this.resolveImage(imgs, expr), 0, 0, T, T);
      return cv;
    }
    // 표정 + 이니셜(정수리) + 하이라이트(눈꺼풀 색면이 튀지 않게 맨 위에)
    ctx.save();
    if (expr === 'glance_left') { ctx.translate(T, 0); ctx.scale(-1, 1); }
    drawPlaceholderFace(ctx, expr === 'glance_left' ? 'glance' : expr, color, fg);
    ctx.restore();
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.85;
    ctx.font = `900 9px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch.initial, T / 2, 6.5);
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(T * 0.35, T * 0.3, 2, T / 2, T / 2, T / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(T / 2, T / 2, T / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    return cv;
  }

  // 특수 타일: 배경색 사각형 + (내용) 글자. 이미지가 있으면 이미지.
  renderSpecial(ch, i) {
    const T = this.tile;
    const [cv, ctx] = this.canvas();
    const color = ch.color;
    const fg = textColorFor(color);
    roundRect(ctx, 1, 1, T - 2, T - 2, 10);
    ctx.fillStyle = color;
    ctx.fill();
    const img = this.specialImgs[i];
    if (img) {
      ctx.save();
      roundRect(ctx, 1, 1, T - 2, T - 2, 10);
      ctx.clip();
      ctx.drawImage(img, 0, 0, T, T);
      ctx.restore();
    } else {
      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = ch.specialLabel || ch.initial;
      let fs = 15;
      ctx.font = `800 ${fs}px ${FONT}`;
      while (fs > 8 && ctx.measureText(label).width > T - 10) {
        fs--;
        ctx.font = `800 ${fs}px ${FONT}`;
      }
      ctx.fillText(label, T / 2, T / 2 + 2);
      ctx.globalAlpha = 0.75;
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ch.initial, 6, 5);
      ctx.globalAlpha = 1;
    }
    roundRect(ctx, 2.5, 2.5, T - 5, T - 5, 9);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    roundRect(ctx, 5.5, 5.5, T - 11, T - 11, 7);
    ctx.strokeStyle = 'rgba(255,215,0,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return cv;
  }

  // flip: 곁눈질 방향 (true = 왼쪽을 봄)
  get(tile, expr = tile.expr, flip = tile.flip) {
    if (tile.special) return this.special[tile.type];
    const set = this.normal[tile.type];
    const e = expr === 'glance' && flip ? 'glance_left' : expr;
    return set && (set[e] || set.stern);
  }
}
