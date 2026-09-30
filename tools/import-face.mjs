// 원화 → 게임용 256px WebP 변환 (전역 playwright 사용, 추가 의존성 없음)
//   node tools/import-face.mjs <id> <표정>=<원본경로> [<표정>=<원본경로> ...]
//   예: node tools/import-face.mjs trump smirk=~/Downloads/a.png shock=~/Downloads/b.png
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SIZE = 256;
const QUALITY = 0.86;
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = createRequire(join(globalRoot, '/'))('playwright');

const [id, ...pairs] = process.argv.slice(2);
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
  const dataUrl = await page.evaluate(async ({ src, size, quality }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    // 반씩 줄여가며 축소 (한 번에 줄이면 거칠어짐)
    let cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d').drawImage(img, 0, 0);
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
  }, { src, size: SIZE, quality: QUALITY });
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  const out = join(outDir, `${expr}.webp`);
  writeFileSync(out, buf);
  console.log(`${out}  ${(buf.length / 1024).toFixed(0)} KB`);
}
await browser.close();
