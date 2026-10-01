// 게임 설정. 코드 수정 없이 여기 값만 바꿔서 조절한다.
export const CONFIG = {
  // 연출 전체 강도 배율. 0이면 모든 연출(히트스톱·파티클·흔들림·스쿼시 등) 꺼짐.
  JUICE: 2.0,

  // 보드 (논리 px)
  COLS: 5,
  ROWS: 7,
  TILE: 68,
  GAP: 3,
  TILE_SHAPE: 'square', // 'square'(둥근 사각형) 또는 'circle'
  BASE_WIDTH: 360,

  // 판별 목표 점수: 1판 TARGET_BASE, 이후 판마다 TARGET_STEP씩 증가
  TARGET_BASE: 1000,
  TARGET_STEP: 250,

  // 입력이 없을 때 힌트까지 대기 시간
  HINT_DELAY_MS: 2000,
  // 이 시간 동안 하나도 못 맞추면(헛스왑 포함) 맞출 곳을 금빛으로 표시
  SPOTLIGHT_DELAY_MS: 10000,

  // 평소 딴짓(눈 굴리기·곁눈질·깜빡임·깡충) 빈도 배율. 0이면 가만히 있음.
  IDLE_ACTIVITY: 1.8,
  IDLE_MIN_MS: 600, // 타일마다 딴짓 간격 (무작위, IDLE_ACTIVITY로 나눔)
  IDLE_MAX_MS: 2200,

  // 낙하 중력 (칸/초²)
  FALL_GRAVITY: 140,

  // 사운드: assets/sounds/에 파일이 있으면 파일, 없으면 합성 효과음(SOUND_SYNTH). 화면 오른쪽 위 버튼으로 음소거.
  SOUND_ENABLED: true,
  SOUND_SYNTH: true,
  SOUND_VOLUME: 0.8,
  SOUNDS: {
    match: 'assets/sounds/match.mp3',
    special: 'assets/sounds/special.mp3',
    clear: 'assets/sounds/clear.mp3',
    chain: 'assets/sounds/chain.mp3', // 연쇄 단계마다 반음씩 피치 상승
  },

  // characters.json 인물에 colorAlt가 있으면 그 색을 쓸지 (색 비교 테스트용). URL에 ?alt=1 을 붙여도 켜짐.
  USE_ALT_COLORS: false,

  // 인물 목록과 판별 활성 인물(levels.order 앞에서부터 levels.counts[판-1]명, 마지막 값 유지)
  CHARACTERS_URL: 'characters.json',

  // 제목 자리에 제목 ↔ 광고 배너를 번갈아 표시. 각 화면 유지 시간(ms), 광고 문구 목록.
  // 순서: 제목 → 광고1 → 제목 → 광고2 → ...  (ADS를 비우면 제목만)
  TOP_ROTATE_MS: 20000,
  ADS: ['이곳에 광고 1', '이곳에 광고 2'],
};

// 판 번호(1부터) → 목표 점수
export function targetScore(level) {
  return CONFIG.TARGET_BASE + CONFIG.TARGET_STEP * (Math.max(1, level) - 1);
}
