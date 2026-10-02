// 보드 순수 로직 (렌더링·애니메이션 없음). 셀 인덱스 idx = r * cols + c.
// 타일 객체는 로직 필드(type, special)와 렌더용 필드(x, y, scale ...)를 함께 가진다.

let nextId = 1;

export function makeTile(type, special = false, r = 0, c = 0) {
  return {
    id: nextId++,
    type,          // characters 배열 인덱스
    special,
    x: c, y: r,    // 셀 단위 렌더 위치
    scale: 1, sx: 1, sy: 1, alpha: 1, jx: 0,
    // 표정·몸짓 (faces.js)
    expr: 'smirk', exprUntil: 0, exprPrio: 0, flip: false,
    ox: 0, oy: 0, rot: 0, motion: 0, nextIdle: 0, phase: Math.random() * Math.PI * 2,
  };
}

export class Board {
  constructor(cols, rows, types, rng = Math.random) {
    this.cols = cols;
    this.rows = rows;
    this.types = types;
    this.rng = rng;
    this.cells = new Array(cols * rows).fill(null);
  }

  idx(r, c) { return r * this.cols + c; }
  rc(idx) { return [Math.floor(idx / this.cols), idx % this.cols]; }
  inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
  get(r, c) { return this.inBounds(r, c) ? this.cells[this.idx(r, c)] : null; }
  // noMatch 아이템(시한폭탄·비둘기 민병대)은 어떤 것과도 매치되지 않는다 (드론은 드론끼리 매치됨)
  typeAt(r, c) { const t = this.get(r, c); return t && !t.noMatch ? t.type : -1; }

  randomType() { return this.types[Math.floor(this.rng() * this.types.length)]; }

  // 매치 없이 + 가능한 수가 하나 이상 있는 보드 생성
  fillInitial() {
    for (let attempt = 0; attempt < 200; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          let type, guard = 0;
          do {
            type = this.randomType();
            guard++;
          } while (guard < 50 && this.makesRunWhenPlaced(r, c, type));
          this.cells[this.idx(r, c)] = makeTile(type, false, r, c);
        }
      }
      if (this.findMatches().groups.length === 0 && this.findMove()) return;
    }
  }

  // (r,c)에 type을 놓으면 왼쪽 두 칸 또는 위쪽 두 칸과 3연속이 되는지
  makesRunWhenPlaced(r, c, type) {
    if (c >= 2 && this.typeAt(r, c - 1) === type && this.typeAt(r, c - 2) === type) return true;
    if (r >= 2 && this.typeAt(r - 1, c) === type && this.typeAt(r - 2, c) === type) return true;
    return false;
  }

  swap(a, b) {
    const ia = this.idx(a.r, a.c), ib = this.idx(b.r, b.c);
    const t = this.cells[ia];
    this.cells[ia] = this.cells[ib];
    this.cells[ib] = t;
  }

  // 가로/세로 3개 이상 연속 동일 인물. 겹치는(같은 셀 공유) 런은 한 그룹으로 합친다.
  findMatches() {
    const n = this.cells.length;
    const parent = new Int32Array(n).fill(-1);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };
    const mark = (list) => {
      for (const i of list) if (parent[i] === -1) parent[i] = i;
      for (let k = 1; k < list.length; k++) union(list[0], list[k]);
    };

    const scan = (outer, inner, at) => {
      for (let o = 0; o < outer; o++) {
        let run = [];
        let runType = -1;
        for (let i = 0; i <= inner; i++) {
          const idx = i < inner ? at(o, i) : -1;
          const type = idx >= 0 && this.cells[idx] && !this.cells[idx].noMatch ? this.cells[idx].type : -1;
          if (type !== -1 && type === runType) {
            run.push(idx);
          } else {
            if (run.length >= 3) mark(run);
            run = type === -1 ? [] : [idx];
            runType = type;
          }
        }
      }
    };
    scan(this.rows, this.cols, (r, c) => this.idx(r, c));
    scan(this.cols, this.rows, (c, r) => this.idx(r, c));

    const byRoot = new Map();
    for (let i = 0; i < n; i++) {
      if (parent[i] === -1) continue;
      const root = find(i);
      if (!byRoot.has(root)) byRoot.set(root, { type: this.cells[i].type, cells: [] });
      byRoot.get(root).cells.push(i);
    }
    const groups = [...byRoot.values()];
    const matched = new Set();
    for (const g of groups) for (const i of g.cells) matched.add(i);
    return { groups, matched };
  }

  // (r,c)를 포함하는 3연속이 있는지
  hasMatchAt(r, c) {
    const type = this.typeAt(r, c);
    if (type === -1) return false;
    let h = 1, v = 1;
    for (let k = c - 1; this.typeAt(r, k) === type; k--) h++;
    for (let k = c + 1; this.typeAt(r, k) === type; k++) h++;
    for (let k = r - 1; this.typeAt(k, c) === type; k--) v++;
    for (let k = r + 1; this.typeAt(k, c) === type; k++) v++;
    return h >= 3 || v >= 3;
  }

  wouldMatch(a, b) {
    if (!this.get(a.r, a.c) || !this.get(b.r, b.c)) return false;
    this.swap(a, b);
    const ok = this.hasMatchAt(a.r, a.c) || this.hasMatchAt(b.r, b.c);
    this.swap(a, b);
    return ok;
  }

  // a↔b를 바꾸면 한 줄로 맞춰지는 칸들 [{ r, c }] (바꾼 뒤 위치 기준)
  matchCellsFor(a, b) {
    if (!this.get(a.r, a.c) || !this.get(b.r, b.c)) return [];
    this.swap(a, b);
    const out = new Map();
    for (const p of [a, b]) {
      const type = this.typeAt(p.r, p.c);
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const run = [p];
        for (let k = 1; this.typeAt(p.r - dr * k, p.c - dc * k) === type; k++) run.push({ r: p.r - dr * k, c: p.c - dc * k });
        for (let k = 1; this.typeAt(p.r + dr * k, p.c + dc * k) === type; k++) run.push({ r: p.r + dr * k, c: p.c + dc * k });
        if (run.length >= 3) for (const q of run) out.set(q.r * this.cols + q.c, q);
      }
    }
    this.swap(a, b);
    return [...out.values()];
  }

  // 가능한 수 목록 (없으면 빈 배열)
  allMoves() {
    const moves = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const a = { r, c };
        if (c + 1 < this.cols && this.wouldMatch(a, { r, c: c + 1 })) moves.push([a, { r, c: c + 1 }]);
        if (r + 1 < this.rows && this.wouldMatch(a, { r: r + 1, c })) moves.push([a, { r: r + 1, c }]);
      }
    }
    return moves;
  }

  findMove() {
    const moves = this.allMoves();
    return moves.length ? moves[Math.floor(this.rng() * moves.length)] : null;
  }

  // 빈칸을 아래로 채우고 위에서 새 타일 생성.
  // 반환: [{ tile, c, fromY, toR }] — fromY가 음수면 보드 위에서 새로 생긴 타일
  collapse() {
    const falls = [];
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const t = this.cells[this.idx(r, c)];
        if (!t) continue;
        if (write !== r) {
          this.cells[this.idx(write, c)] = t;
          this.cells[this.idx(r, c)] = null;
          falls.push({ tile: t, c, fromY: r, toR: write });
        }
        write--;
      }
      const empty = write + 1;
      for (let r = write; r >= 0; r--) {
        const t = makeTile(this.randomType(), false, r - empty, c);
        this.cells[this.idx(r, c)] = t;
        falls.push({ tile: t, c, fromY: r - empty, toR: r });
      }
    }
    return falls;
  }

  // 타일 객체를 섞어 재배치. 매치 없음 + 가능한 수 있음이 될 때까지.
  shuffle() {
    const tiles = this.cells.filter(Boolean);
    for (let attempt = 0; attempt < 300; attempt++) {
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      tiles.forEach((t, i) => { this.cells[i] = t; });
      if (this.findMatches().groups.length === 0 && this.findMove()) return;
    }
    // 드물게 실패하면 일반 타일의 인물을 새로 뽑는다
    for (let attempt = 0; attempt < 300; attempt++) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const t = this.cells[this.idx(r, c)];
          if (t.special) continue;
          this.cells[this.idx(r, c)] = null;
          let guard = 0, type;
          do { type = this.randomType(); guard++; } while (guard < 50 && this.makesRunWhenPlaced(r, c, type));
          t.type = type;
          this.cells[this.idx(r, c)] = t;
        }
      }
      if (this.findMatches().groups.length === 0 && this.findMove()) return;
    }
  }
}
