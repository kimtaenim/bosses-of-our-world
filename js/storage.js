// 진행 상황 저장: 지금 판, 그 판에서 모은 점수, 통산 최고 판, 전체 점수. 저장소를 못 쓰면 조용히 무시.
const KEY = 'bosses-of-our-world.progress';

export function loadProgress() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      reached: Number(v.reached) || 1,
      best: Number(v.best) || 1,
      score: Number(v.score) || 0,
      total: Number(v.total) || 0,
    };
  } catch (_) {
    return { reached: 1, best: 1, score: 0, total: 0 };
  }
}

export function saveProgress({ reached, best, score = 0, total = 0 }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ reached, best, score, total }));
  } catch (_) { /* 무시 */ }
}
