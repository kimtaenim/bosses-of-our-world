// 아이템 타일: 위에서 떨어져 내려오는 특수 타일 (그림 파일이 없으면 emblems.js의 코드 그림)
//   kaiju     카이주 — 31판부터 지울 때마다 1/8(점점 드물게). 탭하면 고질라 같은 괴수가 4~5발자국 걸어 밟는 칸을 부수며 화면 왼쪽이나 오른쪽 밖으로 나감. 셋 맞추면 카이주 다섯 마리가 판을 누빔.
//   ufo       UFO — 41판부터 지울 때마다 1/8(판마다 점점 드물게). 탭하면 빙글빙글 돌며 날아가 무작위 한 칸 펑. 셋 맞추면 일곱 대가 마구 날아다니다 무작위 일곱 칸 펑.
//   secrets   기밀 파일(SECRETS) — 71판부터 지울 때마다 1/8(판마다 점점 드물게). 탭하면 서류가 날리며 가로 한 줄. 셋 맞추면 가로 세 줄.
//   tariff    관세(TARIFF) — 51판부터 지울 때마다 1/8 확률(판마다 점점 드물게). 탭하면 주변 3×3을 리셔플, 셋을 맞추면 터지지 않고 판 전체 리셔플.
//   drone     드론 — 21판부터 지울 때마다 1/6 확률(판마다 점점 드물게). 탭하면 위잉 비틀비틀 날아가 무작위 한 칸에 펑, 셋 맞추면 일곱 대가 마구 날아다니다 무작위 일곱 칸 펑. 판 위에서 둥실둥실. (인물이 아님, 매치되지 않음, 탭하면 발동)
//   nuke      핵폭탄(NUKE) — 61판부터 지울 때마다 1/10 확률(판마다 점점 드물게). 탭하면 3×3, 셋을 한 줄로 맞추면 화면 전체 폭발.
//   timebomb  시한폭탄 — 11판부터 지울 때마다 10% 확률. 8부터 0까지 세고 부르르 떨며 바로 X자 폭발. 시간이 되어야만 터짐.
//   missile   ICBM 미사일 — 1판부터, 한 번에 3개짜리 두 줄 이상을 동시에 지우거나 콤보(연쇄)가 나오면 내려옴. 탭하면 포물선을 그리며 날아가 무작위 2×2를 콰광, 셋을 한 줄로 맞추면 화면 전체 폭발.
// 게임에서는 인물 목록 뒤에 붙인 '가짜 인물'로 다뤄서 특수 타일 연출·연쇄를 그대로 쓴다.
// special에 적힌 그림 파일(정사각)이 있으면 코드 그림 대신 그 그림을 쓴다.

export const ITEMS = [
  { id: 'kaiju', item: 'kaiju', name: '카이주', group: 'item', color: '#14151A', initial: 'K', emblem: 'kaiju', effect: 'kaiju', special: 'assets/special/kaiju.webp', label: 'KAIJU' },
  { id: 'ufo', item: 'ufo', name: 'UFO', group: 'item', color: '#2B1B4E', initial: 'U', emblem: 'ufo', effect: 'ufoStrike' },
  { id: 'secrets', item: 'secrets', name: '기밀 파일', group: 'item', color: '#3B4A3F', initial: 'S', emblem: 'secrets', effect: 'secrets' },
  { id: 'tariff', item: 'tariff', name: '관세', group: 'item', color: '#B3261E', initial: 'T', emblem: 'tariff' },
  { id: 'drone', item: 'drone', name: '드론', group: 'item', color: '#1777EA', initial: 'D', emblem: 'drone', effect: 'droneStrike', special: 'assets/special/drone.webp', label: 'DRONE' },
  { id: 'nuke', item: 'nuke', name: '핵폭탄', group: 'item', color: '#2A2F3A', initial: 'N', emblem: 'nuke', effect: 'bomb' },
  { id: 'timebomb', item: 'timebomb', name: '시한폭탄', group: 'item', color: '#3A3F4F', initial: 'B', emblem: 'timebomb', effect: 'xblast' },
  { id: 'missile', item: 'missile', name: 'ICBM 미사일', group: 'item', color: '#2E4057', initial: 'M', emblem: 'missile', effect: 'missile' },
];

// 카이주 걷기 그림 3장 (오른쪽을 봄, 배경 투명): 왼발 / 오른발 / 서 있기
export const KAIJU_STILL = 'assets/special/kaiju.webp';
export const KAIJU_FRAMES = ['assets/special/kaiju-walk-a.webp', 'assets/special/kaiju-walk-b.webp', 'assets/special/kaiju-walk-c.webp'];

// 시한폭탄 카운트다운: FUSE_FROM부터 1까지 각 1초, 0이 되면 SHAKE_MS 동안 부르르 떨고 바로 폭발.
// 눌러도, 다른 폭발에 휘말려도 안 터진다 — 시간이 되어야만 터짐.
export const FUSE_FROM = 8;
export const SHAKE_MS = 450;
export const FUSE_MS = FUSE_FROM * 1000 + SHAKE_MS;
