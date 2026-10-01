// 아이템 타일: 위에서 떨어져 내려오는 특수 타일 (인물이 아님, 매치되지 않음, 탭하면 발동)
//   globe     지구     — 한 번에 3개짜리 두 줄 이상을 동시에 지우면 내려옴. 3×3 폭탄.
//   timebomb  시한폭탄 — 11판부터 지울 때마다 10% 확률. 5·4·3·2·1·0 세고 부르르 떨다 X자 폭발.
//   dove      평화의 비둘기 — 21판부터 지울 때마다 10% 확률. 탭하면 세로 한 줄.
// 게임에서는 인물 목록 뒤에 붙인 '가짜 인물'로 다뤄서 특수 타일 연출·연쇄를 그대로 쓴다.

export const ITEMS = [
  { id: 'globe', item: 'globe', name: '지구', group: 'item', color: '#1E6FD9', initial: 'G', emblem: 'globe', effect: 'bomb' },
  { id: 'timebomb', item: 'timebomb', name: '시한폭탄', group: 'item', color: '#3A3F4F', initial: 'B', emblem: 'timebomb', effect: 'xblast' },
  { id: 'dove', item: 'dove', name: '평화의 비둘기', group: 'item', color: '#3E9BE0', initial: 'D', emblem: 'dove', effect: 'dove' },
];

// 시한폭탄 카운트다운 (ms): 5 → 0 각 1초, 0에서 1초 떨다가 폭발
export const FUSE_MS = 6000;
