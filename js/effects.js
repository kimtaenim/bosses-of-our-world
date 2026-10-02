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

const bomb5 = {
  // 5×5 대폭발 (드론 셋 맞추기): 바깥쪽부터 25ms 시차
  area(r, c, rows, cols) {
    const out = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const ring = Math.max(Math.abs(dr), Math.abs(dc)); // 2 바깥, 1 안쪽, 0 중심
        out.push({ r: rr, c: cc, delay: (2 - ring) * 25 });
      }
    }
    return out;
  },
  play(game, r, c) {
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 8, game.STEP * 4.5, 360, 10);
    game.fx.ring(x, y, 6, game.STEP * 2.6, 240, 14, '255,244,214');
    game.fx.ring(x, y, 4, game.STEP * 1.4, 160, 10, '120,190,255');
    game.fx.burst(x, y, '#ffffff', 24, 1.8);
    game.fx.burst(x, y, '#1A7AED', 20, 1.5);
    game.fx.burst(x, y, '#FFC93C', 16, 1.2);
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

const MISSILE_FLIGHT = 520; // ms

const missile = {
  // ICBM: 포물선을 그리며 아무 곳에나 날아가 무작위 2×2를 콰광
  area(r, c, rows, cols) {
    const tr = Math.floor(Math.random() * (rows - 1));
    const tc = Math.floor(Math.random() * (cols - 1));
    const out = [{ r, c, delay: 0 }];
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const rr = tr + dr, cc = tc + dc;
        if (rr === r && cc === c) continue;
        out.push({ r: rr, c: cc, delay: MISSILE_FLIGHT });
      }
    }
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const x = game.cx(c), y = game.cy(r);
    const target = (area || []).filter((a) => a.delay > 0);
    if (!target.length) return;
    const tx = target.reduce((s, a) => s + game.cx(a.c), 0) / target.length;
    const ty = target.reduce((s, a) => s + game.cy(a.r), 0) / target.length;
    game.fx.ring(x, y, 4, game.STEP * 0.9, 180, 6, '255,200,120');
    game.fx.arcMissile(x, y, tx, ty, MISSILE_FLIGHT / 1000, game.STEP * 2.2);
    game.tw.after(MISSILE_FLIGHT, () => {
      game.fx.ring(tx, ty, 6, game.STEP * 2, 280, 10, '255,200,120');
      game.fx.ring(tx, ty, 4, game.STEP * 1.1, 180, 12);
      game.fx.burst(tx, ty, '#ffb347', 24, 1.5);
      game.fx.burst(tx, ty, '#ffffff', 12, 1.2);
      game.fx.flash(0.3);
      game.fx.shake(7);
      game.sound.play('special_rocket'); // 콰광
    });
  },
};

const DRONE_FLIGHT = 1100; // ms

const droneStrike = {
  // 드론: 위잉 비틀비틀 날아가 무작위 한 칸에 펑
  area(r, c, rows, cols) {
    let tr, tc;
    do { tr = Math.floor(Math.random() * rows); tc = Math.floor(Math.random() * cols); } while (tr === r && tc === c);
    return [{ r, c, delay: 0 }, { r: tr, c: tc, delay: DRONE_FLIGHT }];
  },
  play(game, r, c, rows, cols, area) {
    const t = (area || []).find((a) => a.delay > 0);
    if (!t) return;
    const x = game.cx(c), y = game.cy(r), tx = game.cx(t.c), ty = game.cy(t.r);
    game.fx.droneFly(x, y, tx, ty, DRONE_FLIGHT / 1000, game.T * 0.95);
    game.tw.after(DRONE_FLIGHT, () => {
      game.fx.ring(tx, ty, 4, game.STEP * 1.2, 220, 9, '255,220,140');
      game.fx.burst(tx, ty, '#ffffff', 16, 1.3);
      game.fx.burst(tx, ty, '#ffb347', 12, 1.1);
      game.fx.shake(5);
      game.sound.play('special_fart'); // 펑 + 방귀
    });
  },
};

const missile3 = {
  // ICBM 셋: 자기 열과 양옆 열, 세로 세 줄 전체 + 미사일 세 발
  area(r, c, rows, cols) {
    const out = [];
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if (cc < 0 || cc >= cols) continue;
      for (let rr = 0; rr < rows; rr++) out.push({ r: rr, c: cc, delay: Math.abs(rr - r) * 25 + Math.abs(dc) * 30 });
    }
    return out;
  },
  play(game, r, c, rows, cols) {
    const sweep = Math.max(r, rows - 1 - r) * 25 + 25;
    for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc;
      if (cc < 0 || cc >= cols) continue;
      game.fx.vbeam(game.cx(cc), game.cy(r), 0, game.BH, game.T * 0.95, sweep / 0.7);
      game.fx.rocket(game.cx(cc), game.cy(r));
    }
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 8, game.STEP * 3, 300, 12, '255,200,120');
    game.fx.burst(x, y, '#ffb347', 30, 1.7);
    game.fx.burst(x, y, '#ffffff', 18, 1.3);
  },
};

const screen = {
  // 화면 전체 폭발 (NUKE·ICBM 셋 맞추기): 가운데부터 바깥으로 퍼지며 전부 터짐
  area(r, c, rows, cols) {
    const out = [];
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
        const d = Math.max(Math.abs(rr - r), Math.abs(cc - c));
        out.push({ r: rr, c: cc, delay: d * 35 });
      }
    }
    return out;
  },
  play(game, r, c, rows, cols) {
    const x = game.cx(c), y = game.cy(r);
    game.fx.ring(x, y, 10, game.STEP * 7, 500, 14);
    game.fx.ring(x, y, 8, game.STEP * 5, 380, 18, '255,220,140');
    game.fx.ring(x, y, 6, game.STEP * 3, 260, 12, '255,120,40');
    for (let cc = 0; cc < cols; cc++) game.fx.rocket(game.cx(cc), game.cy(rows - 1));
    game.fx.burst(x, y, '#ffffff', 40, 2.2);
    game.fx.burst(x, y, '#FFB21F', 36, 1.8);
    game.fx.burst(x, y, '#E2480C', 30, 1.5);
  },
};

export const EFFECTS = {
  bomb, bomb5, row, column, sameType, diagonal, xblast, missile, missile3, screen, droneStrike,
  // 그룹 기본값
  politician: bomb,
  business: row,
};
