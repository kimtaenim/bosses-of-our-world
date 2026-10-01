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
  const mute = document.getElementById('mute');
  const renderMute = () => { mute.textContent = game.sound.muted ? '🔇' : '🔊'; };
  renderMute();
  mute.addEventListener('click', () => { game.sound.setMuted(!game.sound.muted); renderMute(); });
  // 부가 기능(광고 교대·소리)이 실패해도 게임은 반드시 시작한다
  try { rotateTop(config); } catch (err) { console.error(err); }
  try {
    // 시작할 때 소리 켤지 묻기 (?sound=1 / ?sound=0 이면 묻지 않음). 버튼 탭이 곧 오디오 잠금 해제.
    const on = await askSound(params.get('sound'), !game.sound.muted);
    game.sound.setMuted(!on);
    renderMute();
    await game.sound.ready();
  } catch (err) { console.error(err); }
  await game.init(startLevel);
  window.__game = game; // 디버그용
}

function askSound(preset, lastOn) {
  const box = document.getElementById('sound-ask');
  if (!box) return Promise.resolve(lastOn); // 화면 파일이 예전 버전이면 묻지 않고 지난 설정대로
  if (preset === '0' || preset === '1') { box.hidden = true; return Promise.resolve(preset === '1'); }
  box.hidden = false;
  // 지난번 선택에 포커스
  box.querySelector(`[data-sound="${lastOn ? 'on' : 'off'}"]`).focus({ preventScroll: true });
  return new Promise((resolve) => {
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sound]');
      if (!b) return;
      box.hidden = true;
      resolve(b.dataset.sound === 'on');
    });
  });
}

// 제목 ↔ 광고 배너 교대: 제목 → 광고1 → 제목 → 광고2 ...
function rotateTop(config) {
  const ads = config.ADS || [];
  if (!ads.length) return;
  const title = document.getElementById('title');
  const ad = document.getElementById('ad');
  const text = document.getElementById('ad-text');
  if (!title || !ad || !text) return;
  let step = 0;
  setInterval(() => {
    step++;
    const showAd = step % 2 === 1;
    if (showAd) text.textContent = ads[((step - 1) / 2) % ads.length];
    title.classList.toggle('show', !showAd);
    ad.classList.toggle('show', showAd);
  }, Math.max(3000, config.TOP_ROTATE_MS || 20000));
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 지원만 빠짐 */ });
  });
}
