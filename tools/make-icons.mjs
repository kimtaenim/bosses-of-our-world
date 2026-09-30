// 앱 아이콘 PNG 생성 (의존성 없음): node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex('#1c1f33');
const DOTS = ['#D62828', '#FF9900', '#1877F2', '#FFD700'].map(hex);

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 2×2 원형 타일. safe: 원들이 차지하는 비율 (maskable은 작게)
function icon(size, safe, rounded) {
  const SS = 4;
  const cell = (size * safe) / 2;
  const start = (size - size * safe) / 2;
  const rad = cell * 0.44;
  const corner = size * 0.2;
  return png(size, (px, py) => {
    let acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const x = px + (sx + 0.5) / SS, y = py + (sy + 0.5) / SS;
        let inside = true;
        if (rounded) {
          const cx = Math.min(Math.max(x, corner), size - corner);
          const cy = Math.min(Math.max(y, corner), size - corner);
          inside = (x - cx) ** 2 + (y - cy) ** 2 <= corner ** 2;
        }
        if (!inside) continue;
        let col = BG;
        for (let i = 0; i < 4; i++) {
          const ccx = start + cell * (i % 2) + cell / 2;
          const ccy = start + cell * Math.floor(i / 2) + cell / 2;
          const d2 = (x - ccx) ** 2 + (y - ccy) ** 2;
          if (d2 <= rad * rad) {
            // 살짝 하이라이트
            const hl = Math.max(0, 1 - Math.sqrt((x - ccx + rad * 0.3) ** 2 + (y - ccy + rad * 0.35) ** 2) / rad);
            col = DOTS[i].map((v) => Math.min(255, v + hl * 60));
          }
        }
        acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2]; acc[3] += 255;
      }
    }
    const n = SS * SS;
    return acc.map((v) => Math.round(v / n));
  });
}

writeFileSync('icons/icon-192.png', icon(192, 0.8, true));
writeFileSync('icons/icon-512.png', icon(512, 0.8, true));
writeFileSync('icons/icon-maskable-512.png', icon(512, 0.6, false));
writeFileSync('icons/apple-touch-icon.png', icon(180, 0.72, false));
console.log('icons written');
