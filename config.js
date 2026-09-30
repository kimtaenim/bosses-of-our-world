// 게임 설정. 코드 수정 없이 여기 값만 바꿔서 조절한다.
export const CONFIG = {
  // 연출 전체 강도 배율. 0이면 모든 연출(히트스톱·파티클·흔들림·스쿼시 등) 꺼짐.
  JUICE: 1,

  // 보드 (논리 px)
  COLS: 5,
  ROWS: 7,
  TILE: 68,
  GAP: 3,
  TILE_SHAPE: 'square', // 'square'(둥근 사각형) 또는 'circle'
  BASE_WIDTH: 360,

  // 판별 목표 점수. 배열 이후 판은 직전 값 × TARGET_GROWTH (소수점 버림)
  TARGET_SCORES: [1500, 2500, 4000, 6000],
  TARGET_GROWTH: 1.3,

  // 입력이 없을 때 힌트까지 대기 시간
  HINT_DELAY_MS: 2000,

  // 평소 딴짓(눈 굴리기·곁눈질·깜빡임·깡충) 빈도 배율. 0이면 가만히 있음.
  IDLE_ACTIVITY: 1,
  IDLE_MIN_MS: 1500, // 타일마다 딴짓 간격 (무작위, IDLE_ACTIVITY로 나눔)
  IDLE_MAX_MS: 5000,

  // 낙하 중력 (칸/초²)
  FALL_GRAVITY: 140,

  // 사운드: 슬롯만 있고 기본 무음. true로 바꾸고 파일을 넣으면 재생.
  SOUND_ENABLED: false,
  SOUND_VOLUME: 0.8,
  SOUNDS: {
    match: 'assets/sounds/match.mp3',
    special: 'assets/sounds/special.mp3',
    clear: 'assets/sounds/clear.mp3',
    chain: 'assets/sounds/chain.mp3', // 연쇄 단계마다 반음씩 피치 상승
  },

  // characters.json의 colorAlt를 쓸지 (시진핑 노랑 #FFD700 테스트). URL에 ?alt=1 을 붙여도 켜짐.
  USE_ALT_COLORS: false,

  // 인물 목록과 판별 활성 인물(levels.order 앞에서부터 levels.counts[판-1]명, 마지막 값 유지)
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
