// 아이템 타일: 위에서 떨어져 내려오는 특수 타일 (그림 파일이 없으면 emblems.js의 코드 그림)
//   drone     드론 — 31판부터 지울 때마다 1/6 확률(판마다 점점 드물게). 탭하면 위잉 비틀비틀 날아가 무작위 한 칸에 펑. 판 위에서 둥실둥실. (인물이 아님, 매치되지 않음, 탭하면 발동)
//   nuke      핵폭탄(NUKE) — 21판부터 지울 때마다 10% 확률. 탭하면 3×3, 셋을 한 줄로 맞추면 화면 전체 폭발.
//   timebomb  시한폭탄 — 11판부터 지울 때마다 10% 확률. 8부터 0까지 세고 부르르 떨며 바로 X자 폭발. 시간이 되어야만 터짐.
//   missile   ICBM 미사일 — 1판부터, 한 번에 3개짜리 두 줄 이상을 동시에 지우면 내려옴. 탭하면 포물선을 그리며 날아가 무작위 2×2를 콰광, 셋을 한 줄로 맞추면 화면 전체 폭발.
// 게임에서는 인물 목록 뒤에 붙인 '가짜 인물'로 다뤄서 특수 타일 연출·연쇄를 그대로 쓴다.
// special에 적힌 그림 파일(정사각)이 있으면 코드 그림 대신 그 그림을 쓴다.

export const ITEMS = [
  { id: 'drone', item: 'drone', name: '드론', group: 'item', color: '#1777EA', initial: 'D', emblem: 'drone', effect: 'droneStrike', special: 'assets/special/drone.webp', label: 'DRONE' },
  { id: 'nuke', item: 'nuke', name: '핵폭탄', group: 'item', color: '#2A2F3A', initial: 'N', emblem: 'nuke', effect: 'bomb' },
  { id: 'timebomb', item: 'timebomb', name: '시한폭탄', group: 'item', color: '#3A3F4F', initial: 'B', emblem: 'timebomb', effect: 'xblast' },
  { id: 'missile', item: 'missile', name: 'ICBM 미사일', group: 'item', color: '#2E4057', initial: 'M', emblem: 'missile', effect: 'missile' },
];

// 시한폭탄 카운트다운: FUSE_FROM부터 1까지 각 1초, 0이 되면 SHAKE_MS 동안 부르르 떨고 바로 폭발.
// 눌러도, 다른 폭발에 휘말려도 안 터진다 — 시간이 되어야만 터짐.
export const FUSE_FROM = 8;
export const SHAKE_MS = 450;
export const FUSE_MS = FUSE_FROM * 1000 + SHAKE_MS;
