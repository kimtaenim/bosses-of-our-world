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

const droneStrike3 = {
  // 드론 셋: 위잉 비틀비틀 날아가 무작위 위치에 3×3 펑
  area(r, c, rows, cols) {
    const tr = 1 + Math.floor(Math.random() * Math.max(1, rows - 2));
    const tc = 1 + Math.floor(Math.random() * Math.max(1, cols - 2));
    const out = [{ r, c, delay: 0 }];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = tr + dr, cc = tc + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || (rr === r && cc === c)) continue;
        out.push({ r: rr, c: cc, delay: DRONE_FLIGHT + (Math.abs(dr) + Math.abs(dc)) * 25 });
      }
    }
    out.center = { r: tr, c: tc };
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const ctr = area && area.center;
    if (!ctr) return;
    const x = game.cx(c), y = game.cy(r), tx = game.cx(ctr.c), ty = game.cy(ctr.r);
    game.fx.droneFly(x, y, tx, ty, DRONE_FLIGHT / 1000, game.T * 1.2);
    game.tw.after(DRONE_FLIGHT, () => {
      game.fx.ring(tx, ty, 6, game.STEP * 3, 280, 9);
      game.fx.ring(tx, ty, 4, game.STEP * 1.5, 160, 12, '255,244,214');
      game.fx.burst(tx, ty, '#ffffff', 22, 1.5);
      game.fx.burst(tx, ty, '#ffb347', 18, 1.3);
      game.fx.flash(0.3);
      game.fx.shake(8);
      game.sound.play('special_fart'); // 펑 + 방귀
    });
  },
};

// UFO: 드론과 같은 흐름이지만 빙글빙글 돌며 날아감
const UFO_FLIGHT = 1300;
const ufoStrike = {
  area(r, c, rows, cols) {
    let tr, tc;
    do { tr = Math.floor(Math.random() * rows); tc = Math.floor(Math.random() * cols); } while (tr === r && tc === c);
    return [{ r, c, delay: 0 }, { r: tr, c: tc, delay: UFO_FLIGHT }];
  },
  play(game, r, c, rows, cols, area) {
    const t = (area || []).find((a) => a.delay > 0);
    if (!t) return;
    const tx = game.cx(t.c), ty = game.cy(t.r);
    game.fx.droneFly(game.cx(c), game.cy(r), tx, ty, UFO_FLIGHT / 1000, game.T * 1.15, 'ufo');
    game.tw.after(UFO_FLIGHT, () => {
      game.fx.ring(tx, ty, 4, game.STEP * 1.3, 240, 9, '140,255,160');
      game.fx.burst(tx, ty, '#8CFFA0', 16, 1.3);
      game.fx.burst(tx, ty, '#ffffff', 10, 1.1);
      game.fx.shake(5);
      game.sound.play('ufo_zap');
    });
  },
};
const ufoStrike3 = {
  area(r, c, rows, cols) {
    const out = droneStrike3.area(r, c, rows, cols);
    for (const a of out) if (a.delay > 0) a.delay += UFO_FLIGHT - DRONE_FLIGHT;
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const ctr = area && area.center;
    if (!ctr) return;
    const tx = game.cx(ctr.c), ty = game.cy(ctr.r);
    game.fx.droneFly(game.cx(c), game.cy(r), tx, ty, UFO_FLIGHT / 1000, game.T * 1.25, 'ufo');
    game.tw.after(UFO_FLIGHT, () => {
      game.fx.ring(tx, ty, 6, game.STEP * 3, 280, 10, '140,255,160');
      game.fx.burst(tx, ty, '#8CFFA0', 24, 1.6);
      game.fx.flash(0.3);
      game.fx.shake(8);
      game.sound.play('ufo_zap');
    });
  },
};

// 기밀 파일: 가로 한 줄이 날아감 (서류가 흩날림)
const secrets = {
  area: row.area,
  play(game, r, c, rows, cols) {
    row.play(game, r, c, rows, cols);
    const y = game.cy(r);
    for (let cc = 0; cc < cols; cc++) game.fx.burst(game.cx(cc), y, '#ffffff', 5, 1.2);
    game.fx.burst(game.cx(c), y, '#E2BC63', 10, 1.3);
  },
};
const secrets3 = {
  // 기밀 파일 셋: 가로 세 줄
  area(r, c, rows, cols) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= rows) continue;
      for (let cc = 0; cc < cols; cc++) out.push({ r: rr, c: cc, delay: Math.abs(cc - c) * 25 + Math.abs(dr) * 30 });
    }
    return out;
  },
  play(game, r, c, rows, cols) {
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= rows) continue;
      row.play(game, rr, c, rows, cols);
      for (let cc = 0; cc < cols; cc++) game.fx.burst(game.cx(cc), game.cy(rr), '#ffffff', 4, 1.3);
    }
  },
};

// 카이주: 자기 칸에서 시작해 상하좌우·대각선 이웃 칸으로 한 칸씩 다섯 번 쿵쿵, 밟은 칸을 부숨
const KAIJU_STEP = 600; // ms, 한 칸 (멈춤 + 왼발 + 오른발 + 착지) — 다섯 칸 3초
const KAIJU_LAND = 0.85; // 한 칸 안에서 착지하는 시점 (fx.js KAIJU_PAUSE + KAIJU_MOVE)
const kaiju = {
  // 4~5발자국 걸어서 화면 왼쪽이나 오른쪽 밖으로 나감. 마지막 발은 보드 밖, 그 전 칸들은 밟아 부숨.
  // 가로로 나가야 하는 만큼은 옆으로(대각선 포함), 남는 걸음은 위아래로 어슬렁
  area(r, c, rows, cols) {
    const n = 4 + Math.floor(Math.random() * 2);
    const sides = [];
    if (c + 1 <= n) sides.push(-1);      // 왼쪽으로 나가는 데 필요한 걸음 c+1
    if (cols - c <= n) sides.push(1);    // 오른쪽 cols-c
    const dir = sides[Math.floor(Math.random() * sides.length)] || (c < cols / 2 ? -1 : 1);
    const need = dir < 0 ? c + 1 : cols - c;
    // 마지막 걸음은 반드시 옆으로 (밖으로 나가는 걸음)
    const moves = Array(n - need).fill('v').concat(Array(need - 1).fill('h'));
    for (let i = moves.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [moves[i], moves[j]] = [moves[j], moves[i]]; }
    moves.push('h');
    // 위아래로 갈 때는 한 방향(여유가 많은 쪽)으로만 → 왔던 칸을 되밟지 않음
    const vdir = r >= rows - 1 - r ? -1 : 1;
    const path = [{ r, c }];
    let cur = { r, c };
    for (const mv of moves) {
      const canV = cur.r + vdir >= 0 && cur.r + vdir < rows;
      let dr, dc;
      if (mv === 'v') { dr = canV ? vdir : 0; dc = dr ? 0 : dir; }
      else { dc = dir; dr = canV && Math.random() < 0.35 ? vdir : 0; } // 옆으로, 가끔 대각선
      cur = { r: cur.r + dr, c: cur.c + dc };
      path.push(cur);
      if (cur.c < 0 || cur.c >= cols) break; // 밖으로 나갔으면 끝
    }
    if (cur.c >= 0 && cur.c < cols) path.push({ r: cur.r, c: dir < 0 ? -1 : cols }); // 혹시 안 나갔으면 마지막에 밖으로
    const out = [{ r, c, delay: 0 }];
    path.slice(1).forEach((p, i) => {
      if (p.c < 0 || p.c >= cols) return; // 보드 밖
      if (!out.some((o) => o.r === p.r && o.c === p.c)) out.push({ r: p.r, c: p.c, delay: (i + KAIJU_LAND) * KAIJU_STEP });
    });
    out.path = path;
    return out;
  },
  play(game, r, c, rows, cols, area) {
    const path = (area && area.path) || [{ r, c }];
    kaijuWalk(game, path, 0);
    game.tw.after((path.length - 1 + KAIJU_LAND) * KAIJU_STEP, () => game.sound.play('kaiju_poop')); // 사라지며 똥방귀
  },
};

// 카이주 한 마리가 path를 따라 걷는 연출. 한 칸에 소리 하나씩:
//   걷는 동안 포효 "캬아아아", 화면 밖으로 나가면서 똥방귀
function kaijuWalk(game, path, offset) {
  game.tw.after(offset, () => game.fx.kaiju(path.map((p) => ({ x: game.cx(p.c), y: game.cy(p.r) })), KAIJU_STEP / 1000, game.T * 1.2));
  path.slice(1).forEach((p, i) => {
    const base = offset + i * KAIJU_STEP;
    if (p.c < 0 || p.c >= game.cfg.COLS) return; // 화면 밖으로 나가는 마지막 걸음은 부수지 않음
    game.tw.after(base + KAIJU_LAND * KAIJU_STEP, () => {
      const x = game.cx(p.c), y = game.cy(p.r);
      game.fx.ring(x, y, 4, game.STEP * 0.9, 160, 8, '200,255,160');
      game.fx.burst(x, y, '#8a7a66', 10, 1.2); // 부서진 잔해
      game.fx.shake(5);
      game.sound.play('kaiju_stomp');
      game.kaijuScare(p.r, p.c); // 주변 얼굴들 비명·덜덜
    });
  });
}

// 카이주 셋: 판 곳곳에서 카이주 다섯 마리가 나타나 각자 다섯 칸씩 쿵쿵 누비고 다님
const kaiju5 = {
  area(r, c, rows, cols) {
    const out = [{ r, c, delay: 0 }];
    const paths = [];
    for (let k = 0; k < 5; k++) {
      const sr = Math.floor(Math.random() * rows), sc = Math.floor(Math.random() * cols);
      const one = kaiju.area(sr, sc, rows, cols);
      const offset = k * 180;
      paths.push({ path: one.path, offset });
      for (const a of one) {
        const d = a.delay + offset;
        const prev = out.find((o) => o.r === a.r && o.c === a.c);
        if (prev) prev.delay = Math.min(prev.delay, d);
        else out.push({ r: a.r, c: a.c, delay: d });
      }
    }
    out.paths = paths;
    return out;
  },
  play(game, r, c, rows, cols, area) {
    for (const { path, offset } of (area && area.paths) || []) kaijuWalk(game, path, offset);
    game.tw.after((5 + KAIJU_LAND) * KAIJU_STEP + 4 * 180, () => game.sound.play('kaiju_poop')); // 똥방귀
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

// 방사능 홍차 (푸틴): 꿀꺽꿀꺽 마신 뒤, 주변 3×3이 터지는 대신 가운데로 쑤욱 빨려 들어가며 사라짐
export const TEA_GULP_MS = 650;
const teaSink = {
  area(r, c, rows, cols) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        out.push({ r: rr, c: cc, delay: ring ? TEA_GULP_MS + (Math.abs(dr) + Math.abs(dc)) * 40 : TEA_GULP_MS + 160, sink: { r, c } });
      }
    }
    return out;
  },
  play(game, r, c) {
    const x = game.cx(c), y = game.cy(r);
    // 마시는 동안 초록 김이 피어오르고, 꺼져 들어갈 때 소용돌이 고리가 안으로 조여듦
    game.fx.burst(x, y, '#9BFF8A', 10, 0.6);
    game.tw.after(TEA_GULP_MS, () => {
      game.fx.ring(x, y, game.STEP * 1.7, 4, 420, 10, '150,255,130');
      game.fx.ring(x, y, game.STEP * 1.2, 2, 360, 6, '255,220,80');
    });
  },
};

export const EFFECTS = {
  bomb, bomb5, row, column, sameType, diagonal, xblast, missile, missile3, screen, droneStrike, droneStrike3, ufoStrike, ufoStrike3, secrets, secrets3, kaiju, kaiju5, teaSink,
  // 그룹 기본값
  politician: bomb,
  business: row,
};
