// 진행 상황 저장: 지금 판, 그 판 점수·경과 시간, 통산 최고 판, 전체 점수, 하이스코어(전체 점수 최고 기록). 저장소를 못 쓰면 조용히 무시.
const KEY = 'bosses-of-our-world.progress';

export function loadProgress() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      reached: Number(v.reached) || 1,
      best: Number(v.best) || 1,
      score: Number(v.score) || 0,
      total: Number(v.total) || 0,
      high: Number(v.high) || 0,
      elapsed: Number(v.elapsed) || 0,
    };
  } catch (_) {
    return { reached: 1, best: 1, score: 0, total: 0, high: 0, elapsed: 0 };
  }
}

export function saveProgress({ reached, best, score = 0, total = 0, high = 0, elapsed = 0 }) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ reached, best, score, total, high, elapsed: Math.round(elapsed) }));
  } catch (_) { /* 무시 */ }
}
