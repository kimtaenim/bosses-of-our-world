// 인물 타일 스프라이트. 이미지가 없으면 플레이스홀더를 그린다.
// 스프라이트는 화면 해상도에 맞춰 오프스크린 캔버스로 미리 렌더링해 둔다.

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

// 밝은 배경색이면 글자를 어둡게
function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 186 ? '#1a1a1a' : '#ffffff';
}

const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

export class Sprites {
  constructor(characters, tile) {
    this.characters = characters;
    this.tile = tile;
    this.faces = [];
    this.specials = [];
    this.normal = [];
    this.special = [];
    this.pxScale = 0;
  }

  async load() {
    const [faces, specials] = await Promise.all([
      Promise.all(this.characters.map((ch) => loadImage(ch.face))),
      Promise.all(this.characters.map((ch) => loadImage(ch.special))),
    ]);
    this.faces = faces;
    this.specials = specials;
  }

  // pxScale = 논리 px → 실제 픽셀 배율 (보드 스케일 × devicePixelRatio)
  build(pxScale) {
    if (Math.abs(pxScale - this.pxScale) < 0.01) return;
    this.pxScale = pxScale;
    this.normal = this.characters.map((ch, i) => this.render(ch, i, false));
    this.special = this.characters.map((ch, i) => this.render(ch, i, true));
  }

  render(ch, i, isSpecial) {
    const T = this.tile;
    const size = Math.max(8, Math.ceil(T * this.pxScale));
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.scale(size / T, size / T);
    const color = ch.color;
    const fg = textColorFor(color);

    if (!isSpecial) {
      // 배경색 원 + 흰색 이니셜 (얼굴 이미지가 있으면 원 위에 얼굴)
      ctx.beginPath();
      ctx.arc(T / 2, T / 2, T / 2 - 1, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const img = this.faces[i];
      if (img) {
        ctx.drawImage(img, 0, 0, T, T);
      } else {
        // 살짝 하이라이트
        const g = ctx.createRadialGradient(T * 0.35, T * 0.3, 2, T / 2, T / 2, T / 2);
        g.addColorStop(0, 'rgba(255,255,255,0.28)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.font = `800 28px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch.initial, T / 2, T / 2 + 1);
      }
      return cv;
    }

    // 특수 타일: 배경색 사각형 + (내용) 글자. 이미지가 있으면 이미지.
    roundRect(ctx, 1, 1, T - 2, T - 2, 10);
    ctx.fillStyle = color;
    ctx.fill();
    const img = this.specials[i];
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
    // 특수 표시 테두리
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

  get(tile) {
    return (tile.special ? this.special : this.normal)[tile.type];
  }
}
