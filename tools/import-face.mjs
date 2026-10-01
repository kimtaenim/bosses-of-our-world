// 원화 → 게임용 256px WebP 변환 (전역 playwright 사용, 추가 의존성 없음)
//   node tools/import-face.mjs <id> <표정>=<원본경로> [<표정>=<원본경로> ...]
//   예: node tools/import-face.mjs trump smirk=~/Downloads/a.png shock=~/Downloads/b.png
//   배경색 바꾸기: --bg=#7CCBF5  (모서리에서 이어진 단색 배경을 그 색으로 칠함)
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 256;
const QUALITY = 0.86;
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(join(globalRoot, '/'))('playwright');

const args = process.argv.slice(2);
const bgArg = args.find((a) => a.startsWith('--bg='));
const bg = bgArg ? bgArg.slice(5) : null;
const [id, ...pairs] = args.filter((a) => !a.startsWith('--'));
if (!id || !pairs.length) {
  console.error('usage: node tools/import-face.mjs <id> <expr>=<file> ...');
  process.exit(1);
}
const outDir = join('assets/faces', id);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
for (const pair of pairs) {
  const [expr, file] = pair.split('=');
  const src = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const dataUrl = await page.evaluate(async ({ src, size, quality, bg }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    // 반씩 줄여가며 축소 (한 번에 줄이면 거칠어짐)
    let cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
    if (bg) {
      // 모서리 색과 비슷하고 모서리에서 이어진 픽셀을 새 배경색으로 (가장자리는 섞어서 부드럽게)
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const im = ctx.getImageData(0, 0, W, H), d = im.data;
      const n = parseInt(bg.slice(1), 16), nr = n >> 16, ng = (n >> 8) & 255, nb = n & 255;
      const or = d[0], og = d[1], ob = d[2];
      const dist = (i) => Math.hypot(d[i] - or, d[i + 1] - og, d[i + 2] - ob);
      const HARD = 40, SOFT = 90;
      const seen = new Uint8Array(W * H);
      const stack = [0, W - 1, (H - 1) * W, H * W - 1];
      while (stack.length) {
        const p = stack.pop();
        if (seen[p]) continue;
        seen[p] = 1;
        const i = p * 4, e = dist(i);
        if (e > SOFT) continue;
        const k = e <= HARD ? 1 : 1 - (e - HARD) / (SOFT - HARD);
        d[i] += (nr - d[i]) * k; d[i + 1] += (ng - d[i + 1]) * k; d[i + 2] += (nb - d[i + 2]) * k;
        if (e > HARD) continue; // 부드러운 가장자리에서 멈춤
        const x = p % W, y = (p / W) | 0;
        if (x > 0) stack.push(p - 1);
        if (x < W - 1) stack.push(p + 1);
        if (y > 0) stack.push(p - W);
        if (y < H - 1) stack.push(p + W);
      }
      ctx.putImageData(im, 0, 0);
    }
    while (cv.width / 2 >= size) {
      const next = document.createElement('canvas');
      next.width = Math.round(cv.width / 2); next.height = Math.round(cv.height / 2);
      const c = next.getContext('2d');
      c.imageSmoothingQuality = 'high';
      c.drawImage(cv, 0, 0, next.width, next.height);
      cv = next;
    }
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const c = out.getContext('2d');
    c.imageSmoothingQuality = 'high';
    c.drawImage(cv, 0, 0, size, size);
    return out.toDataURL('image/webp', quality);
  }, { src, size: SIZE, quality: QUALITY, bg });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const out = join(outDir, `${expr}.webp`);
  writeFileSync(out, buf);
  console.log(`${out}  ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();
