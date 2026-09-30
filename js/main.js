import { CONFIG } from '../config.js';
import { Game } from './game.js';
import { attachInput } from './input.js';

async function main() {
  const res = await fetch(CONFIG.CHARACTERS_URL);
  const data = await res.json();

  const hud = {
    level: document.getElementById('level'),
    score: document.getElementById('score'),
    target: document.getElementById('target'),
    bar: document.getElementById('bar-fill'),
    best: document.getElementById('best'),
    banner: document.getElementById('banner'),
  };
  const canvas = document.getElementById('game');
  const game = new Game(canvas, data.characters, CONFIG, hud);
  attachInput(canvas, game);
  await game.init();
  window.__game = game; // 디버그용
}

main();
