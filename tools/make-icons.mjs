// 앱 아이콘·파비콘 생성 (전역 playwright 사용): node tools/make-icons.mjs <원본 얼굴 PNG>
// 원본은 인물 배경색이 칠해진 정사각 그림. 모서리 색으로 여백을 채운다.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/make-icons.mjs <face.png>'); process.exit(1); }
const { chromium } = createRequire(join(execSync('npm root -g').toString().trim(), '/'))('playwright');

// [파일, 크기, 얼굴 비율(1=꽉 채움)]  maskable은 안전 영역(가운데 80%)에 얼굴이 들어가게 작게
const OUT = [
  ['icons/icon-192.png', 192, 1],
  ['icons/icon-512.png', 512, 1],
  ['icons/icon-maskable-512.png', 512, 0.78],
  ['icons/apple-touch-icon.png', 180, 1],
  ['icons/favicon-32.png', 32, 1.12],
  ['icons/favicon-48.png', 48, 1.08],
];

const browser = await chromium.launch();
const page = await browser.newPage();
const data = `data:image/png;base64,${readFileSync(src).toString('base64')}`;
for (const [file, size, k] of OUT) {
  const url = await page.evaluate(async ({ data, size, k }) => {
    const img = new Image(); img.src = data; await img.decode();
    // 반씩 줄여 부드럽게
    let cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    const target = size * k;
    while (cv.width / 2 >= target) {
      const n = document.createElement('canvas'); n.width = n.height = Math.round(cv.width / 2);
      const c = n.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(cv, 0, 0, n.width, n.height); cv = n;
    }
    const out = document.createElement('canvas'); out.width = out.height = size;
    const ctx = out.getContext('2d');
    const px = img.width > 4 ? (() => { const t = document.createElement('canvas'); t.width = t.height = 1; const tc = t.getContext('2d'); tc.drawImage(img, 3, 3, 1, 1, 0, 0, 1, 1); const d = tc.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; })() : '#d62828';
    ctx.fillStyle = px; ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cv, (size - target) / 2, (size - target) / 2, target, target);
    return out.toDataURL('image/png');
  }, { data, size, k });
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(file, size);
}
await browser.close();
