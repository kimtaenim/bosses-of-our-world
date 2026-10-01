// 특수 타일 효과. characters.json에서 인물의 "effect" 값(없으면 "group" 값)으로 고른다.
//   area(r, c, rows, cols, board, type) 마지막 두 인자는 같은 인물 찾기용
// 새 효과를 추가하려면 여기에 항목 하나만 추가하면 된다.
//   area(r, c, rows, cols) → [{ r, c, delay }]  제거할 칸과 발동 시점 기준 터지는 시차(ms)
//   play(game, r, c, rows, cols)                 발동 순간의 연출

const bomb = {
  // 3×3 폭탄: 바깥쪽(모서리 → 변 → 중심)부터 30ms 시차
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
};

const row = {
  // 가로 한 행 전체: 자기 위치에서 양쪽 끝으로 25ms 시차
  area(r, c, rows, cols) {
    const out = [];
    for (let cc = 0; cc < cols; cc++) out.push({ r, c: cc, delay: Math.abs(cc - c) * 25 });
    return out;
  },
  play(game, r, c, rows, cols) {
    const sweep = Math.max(c, cols - 1 - c) * 25 + 25;
    game.fx.beam(game.cy(r), game.cx(c), 0, game.BW, game.T * 0.95, sweep / 0.7);
  },
};

const column = {
  // 세로 한 열 전체 (로켓 발사): 자기 위치에서 위아래로 25ms 시차, 로켓이 위로 날아감
  area(r, c, rows) {
    const out = [];
    for (let rr = 0; rr < rows; rr++) out.push({ r: rr, c, delay: Math.abs(rr - r) * 25 });
    return out;
  },
  play(game, r, c, rows) {
    const sweep = Math.max(r, rows - 1 - r) * 25 + 25;
    game.fx.vbeam(game.cx(c), game.cy(r), 0, game.BH, game.T * 0.95, sweep / 0.7);
    game.fx.rocket(game.cx(c), game.cy(r));
  },
};

const sameType = {
  // 같은 인물 전부 (AI가 다 가져감): 가까운 것부터 20ms 시차, 번개가 하나씩 꽂힘
  area(r, c, rows, cols, board, type) {
    const out = [];
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        const t = board.get(rr, cc);
        if (!t || t.type !== type) continue;
        const d = Math.abs(rr - r) + Math.abs(cc - c);
        out.push({ r: rr, c: cc, delay: d * 20 });
      }
    }
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 6, game.STEP * 1.6, 260, 8, '190,160,255');
    for (const a of area || []) {
      if (a.r === r && a.c === c) continue;
      game.fx.zap(x, y, game.cx(a.c), game.cy(a.r), a.delay);
    }
  },
};

const diagonal = {
  // X자 대각선 두 줄 (오일 머니): 가운데부터 바깥으로 30ms 시차, 금빛 석유가 사방으로 튐
  area(r, c, rows, cols) {
    const out = [{ r, c, delay: 0 }];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      for (let k = 1; ; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) break;
        out.push({ r: rr, c: cc, delay: k * 30 });
      }
    }
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 6, game.STEP * 1.8, 260, 8, '255,214,90');
    for (const a of area || []) {
      if (a.r === r && a.c === c) continue;
      game.fx.zap(x, y, game.cx(a.c), game.cy(a.r), a.delay, '255,200,60');
    }
    game.fx.burst(x, y, '#FFC93C', 20, 1.4);
  },
};

const xblast = {
  // 성조기: X자 대각선 끝까지 (가운데 칸 + 네 방향). 가운데부터 바깥으로 30ms 시차
  area(r, c, rows, cols) {
    const seen = new Map();
    const add = (rr, cc, delay) => {
      if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) return;
      const k = rr * cols + cc;
      if (!seen.has(k) || seen.get(k).delay > delay) seen.set(k, { r: rr, c: cc, delay });
    };
    add(r, c, 0);
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      for (let k = 1; k < Math.max(rows, cols); k++) add(r + dr * k, c + dc * k, k * 30);
    }
    return [...seen.values()];
  },
  play(game, r, c, rows, cols, area) {
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 6, game.STEP * 3, 300, 8, '255,255,255');
    game.fx.ring(x, y, 4, game.STEP * 1.6, 200, 12, '230,60,70');
    // 대각선 네 방향으로 빨강·파랑 번개
    for (const a of area || []) {
      if (Math.abs(a.r - r) !== Math.abs(a.c - c) || a.r === r) continue;
      const k = Math.abs(a.r - r);
      game.fx.zap(x, y, game.cx(a.c), game.cy(a.r), a.delay, k % 2 ? '235,60,70' : '70,110,235');
    }
    game.fx.burst(x, y, '#ffffff', 16, 1.6);
    game.fx.burst(x, y, '#D62828', 14, 1.3);
    game.fx.burst(x, y, '#1f4fd1', 14, 1.1);
  },
};

export const EFFECTS = {
  bomb, row, column, sameType, diagonal, xblast,
  // 그룹 기본값
  politician: bomb,
  business: row,
};
