// 게임 설정. 코드 수정 없이 여기 값만 바꿔서 조절한다.
export const CONFIG = {
  // 연출 전체 강도 배율. 0이면 모든 연출(히트스톱·파티클·흔들림·스쿼시 등) 꺼짐.
  JUICE: 1,

  // 보드 (논리 px)
  COLS: 6,
  ROWS: 8,
  TILE: 56,
  GAP: 4,
  BASE_WIDTH: 360,

  // 판별 목표 점수. 배열 이후 판은 직전 값 × TARGET_GROWTH (소수점 버림)
  TARGET_SCORES: [1500, 2500, 4000, 6000],
  TARGET_GROWTH: 1.3,

  // 입력이 없을 때 힌트까지 대기 시간
  HINT_DELAY_MS: 2000,

  // 낙하 중력 (칸/초²)
  FALL_GRAVITY: 140,

  CHARACTERS_URL: 'characters.json',
};

// 판 번호(1부터) → 목표 점수
export function targetScore(level) {
  const list = CONFIG.TARGET_SCORES;
  if (level <= list.length) return list[level - 1];
  let v = list[list.length - 1];
  for (let i = list.length; i < level; i++) v = Math.floor(v * CONFIG.TARGET_GROWTH);
  return v;
}
