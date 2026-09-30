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

  // 낙하 중력 (칸/초²)
  FALL_GRAVITY: 140,

  CHARACTERS_URL: 'characters.json',
};
