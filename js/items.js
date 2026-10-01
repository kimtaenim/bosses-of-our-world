// 아이템 타일: 위에서 떨어져 내려오는 특수 타일 (그림 파일이 없으면 emblems.js의 코드 그림) (인물이 아님, 매치되지 않음, 탭하면 발동)
//   drone     드론 폭탄 — 한 번에 3개짜리 두 줄 이상을 동시에 지우면 내려옴. 3×3 폭탄. (그림: assets/special/drone.webp)
//   timebomb  시한폭탄 — 11판부터 지울 때마다 10% 확률. 5·4·3·2·1·0 세고 부르르 떨며 바로 X자 폭발.
//   dove      비둘기 민병대 — 21판부터 지울 때마다 10% 확률. 탭하면 세로 한 줄. (그림: assets/special/dove.webp)
// 게임에서는 인물 목록 뒤에 붙인 '가짜 인물'로 다뤄서 특수 타일 연출·연쇄를 그대로 쓴다.
// special에 적힌 그림 파일(정사각)이 있으면 코드 그림 대신 그 그림을 쓴다.

export const ITEMS = [
  { id: 'drone', item: 'drone', name: '드론 폭탄', group: 'item', color: '#1A7AED', initial: 'D', emblem: 'globe', effect: 'bomb', special: 'assets/special/drone.webp' },
  { id: 'timebomb', item: 'timebomb', name: '시한폭탄', group: 'item', color: '#3A3F4F', initial: 'B', emblem: 'timebomb', effect: 'xblast' },
  { id: 'dove', item: 'dove', name: '비둘기 민병대', group: 'item', color: '#3FBCFD', initial: 'D', emblem: 'dove', effect: 'dove', special: 'assets/special/dove.webp' },
];

// 시한폭탄 카운트다운: 5·4·3·2·1 각 1초, 0이 되면 SHAKE_MS 동안 부르르 떨고 바로 폭발
export const SHAKE_MS = 450;
export const FUSE_MS = 5000 + SHAKE_MS;
