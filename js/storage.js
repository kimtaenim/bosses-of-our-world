// 도달 판 수와 통산 최고 판만 저장. 저장소를 못 쓰면 조용히 무시.
const KEY = 'bosses-of-our-world.progress';

export function loadProgress() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { reached: Number(v.reached) || 1, best: Number(v.best) || 1 };
  } catch (_) {
    return { reached: 1, best: 1 };
  }
}

export function saveProgress(reached, best) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ reached, best }));
  } catch (_) { /* 무시 */ }
}
