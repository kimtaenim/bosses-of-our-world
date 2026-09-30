// 특수 타일 효과: characters.json의 group 값 → 효과.
// 새 그룹을 추가하려면 여기에 항목 하나만 추가하면 된다.
//   area(r, c, rows, cols) → [{ r, c, delay }]  제거할 칸과 발동 시점 기준 터지는 시차(ms)
//   play(game, r, c, rows, cols)                 발동 순간의 연출

export const EFFECTS = {
  // 3×3 폭탄: 바깥쪽(모서리 → 변 → 중심)부터 30ms 시차
  politician: {
    area(r, c, rows, cols) {
      const out = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const ring = Math.abs(dr) + Math.abs(dc); // 2 모서리, 1 변, 0 중심
          out.push({ r: rr, c: cc, delay: (2 - ring) * 30 });
        }
      }
      return out;
    },
    play(game, r, c) {
      const x = game.cx(c), y = game.cy(r);
      // 얼굴 중심에서 3칸 반경까지 퍼지는 원형 충격파
      game.fx.ring(x, y, 6, game.STEP * 3, 280, 7);
      game.fx.ring(x, y, 4, game.STEP * 1.5, 160, 12, '255,244,214');
    },
  },

  // 세로 한 열 전체: 위에서 아래로 25ms 시차
  business: {
    area(r, c, rows) {
      const out = [];
      for (let rr = 0; rr < rows; rr++) out.push({ r: rr, c, delay: rr * 25 });
      return out;
    },
    play(game, r, c, rows) {
      const sweep = rows * 25;
      game.fx.beam(game.cx(c), 0, game.BH, game.T * 0.95, sweep / 0.7);
    },
  },
};
