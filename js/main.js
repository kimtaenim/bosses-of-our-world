import { CONFIG } from '../config.js';
import { Game } from './game.js';
import { attachInput } from './input.js';
import { ITEMS } from './items.js';

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
  })).concat(ITEMS); // 아이템(지구·시한폭탄·화살표)은 인물 뒤에 가짜 인물로 붙인다
  // ?level=N 이면 그 판부터, 아니면 저장된 판·점수에서 이어하기
  const startLevel = parseInt(params.get('level'), 10) > 0 ? parseInt(params.get('level'), 10) : null;

  const hud = {
    level: document.getElementById('level'),
    score: document.getElementById('score'),
    target: document.getElementById('target'),
    bar: document.getElementById('bar-fill'),
    best: document.getElementById('best'),
    total: document.getElementById('total'),
    high: document.getElementById('high'),
    timer: document.getElementById('timer'),
    banner: document.getElementById('banner'),
  };
  const canvas = document.getElementById('game');
  const game = new Game(canvas, characters, data, config, hud);
  attachInput(canvas, game);
  const mute = document.getElementById('mute');
  // "sound O" (초록) / "sound X" (빨강) 로 켜짐·꺼짐을 한눈에
  const renderMute = () => {
    const on = !game.sound.muted;
    mute.innerHTML = `sound <b class="${on ? 'on' : 'off'}">${on ? 'O' : 'X'}</b>`;
    mute.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  renderMute();
  mute.addEventListener('click', () => {
    game.sound.setMuted(!game.sound.muted);
    renderMute();
    if (!game.sound.muted) game.sound.ready().then(() => game.sound.play('match')).catch(() => {}); // 켜졌다는 확인 소리
  });
  document.getElementById('restart').addEventListener('click', () => {
    if (game.busy) return;
    if (window.confirm('1판부터 다시 할까요?\n총점은 0이 되고, 하이스코어와 최고 판은 남아요.')) game.restart();
  });
  // ?debug=1: 오디오 상태를 화면에 표시 (폰에서 소리 문제 확인용)
  if (params.get('debug') === '1') {
    const best = document.getElementById('best-box');
    setInterval(() => {
      const sd = game.sound;
      best.textContent = `audio:${sd.ctx ? sd.ctx.state : 'none'} muted:${sd.muted} tag:${sd.tag ? (sd.tag.paused ? 'paused' : 'play') : '-'}`;
    }, 500);
  }
  // 부가 기능(광고 교대·소리)이 실패해도 게임은 반드시 시작한다
  try { rotateTop(config); } catch (err) { console.error(err); }
  // 게임은 묻는 창과 상관없이 바로 시작한다 (창이 안 보이거나 깨져도 멈추지 않게).
  // 소리 켤지 묻는 창은 게임 위에 떠 있고, 고르면 그때 소리를 켠다. (?sound=1 / ?sound=0 이면 묻지 않음)
  askSound(params.get('sound'), !game.sound.muted).then((on) => {
    game.sound.setMuted(!on);
    renderMute();
    if (on) game.sound.ready().then(() => game.sound.play('match')).catch(() => {}); // 켜졌다는 확인 소리
  }).catch((err) => console.error(err));
  window.__game = game; // 디버그용
  await game.init(startLevel);
}

function askSound(preset, lastOn) {
  const box = document.getElementById('sound-ask');
  if (!box) return Promise.resolve(lastOn); // 화면 파일이 예전 버전이면 묻지 않고 지난 설정대로
  const hide = () => { box.hidden = true; box.style.display = 'none'; };
  if (preset === '0' || preset === '1') { hide(); return Promise.resolve(preset === '1'); }
  box.hidden = false;
  box.style.display = 'flex';
  // 지난번 선택에 포커스
  box.querySelector(`[data-sound="${lastOn ? 'on' : 'off'}"]`).focus({ preventScroll: true });
  return new Promise((resolve) => {
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sound]');
      if (!b) return;
      hide();
      resolve(b.dataset.sound === 'on');
    });
  });
}

// 제목 ↔ 광고 배너 교대: 제목 → 광고1 → 제목 → 광고2 → 제목 → 광고1 ...
// 제목은 TOP_TITLE_MS, 광고는 TOP_AD_MS 동안 (광고는 짧게)
function rotateTop(config) {
  const ads = config.ADS || [];
  if (!ads.length) return;
  const title = document.getElementById('title');
  const ad = document.getElementById('ad');
  const text = document.getElementById('ad-text');
  if (!title || !ad || !text) return;
  const titleMs = Math.max(2000, config.TOP_TITLE_MS || 20000);
  const adMs = Math.max(2000, config.TOP_AD_MS || 6000);
  let next = 0; // 다음에 보여줄 광고 번호
  const showTitle = () => {
    title.classList.add('show');
    ad.classList.remove('show');
    setTimeout(showAd, titleMs);
  };
  const showAd = () => {
    text.textContent = ads[next];
    next = (next + 1) % ads.length;
    title.classList.remove('show');
    ad.classList.add('show');
    setTimeout(showTitle, adMs);
  };
  setTimeout(showAd, titleMs);
}

main();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 오프라인 지원만 빠짐 */ });
  });
}
