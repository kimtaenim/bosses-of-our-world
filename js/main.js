import { CONFIG } from '../config.js';
import { Game } from './game.js';
import { attachInput } from './input.js';

async function main() {
  const res = await fetch(CONFIG.CHARACTERS_URL);
  const data = await res.json();

  // URL 파라미터로 폰에서 바로 조절: ?alt=1  ?juice=0.5  ?level=3
  const params = new URLSearchParams(location.search);
  const config = { ...CONFIG };
  if (params.has('juice')) config.JUICE = Math.max(0, Number(params.get('juice')) || 0);
  const useAlt = config.USE_ALT_COLORS || params.get('alt') === '1';
  const characters = data.characters.map((ch) => ({
    ...ch,
    color: useAlt && ch.colorAlt ? ch.colorAlt : ch.color,
  }));
  const startLevel = Math.max(1, parseInt(params.get('level'), 10) || 1);

  const hud = {
    level: document.getElementById('level'),
    score: document.getElementById('score'),
    target: document.getElementById('target'),
    bar: document.getElementById('bar-fill'),
    best: document.getElementById('best'),
    banner: document.getElementById('banner'),
  };
  const canvas = document.getElementById('game');
  const game = new Game(canvas, characters, data, config, hud);
  attachInput(canvas, game);
  await game.init(startLevel);
  window.__game = game; // 디버그용
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 지원만 빠짐 */ });
  });
}
