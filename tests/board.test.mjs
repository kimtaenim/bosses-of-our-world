import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Board, makeTile } from '../js/board.js';

function fromRows(rows, types = [0, 1, 2, 3]) {
  const b = new Board(rows[0].length, rows.length, types);
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    b.cells[b.idx(r, c)] = ch === '.' ? null : makeTile(Number(ch), false, r, c);
  }));
  return b;
}

test('initial board has no matches and has a move', () => {
  for (let i = 0; i < 200; i++) {
    const b = new Board(6, 8, [0, 1, 2, 3]);
    b.fillInitial();
    assert.equal(b.findMatches().groups.length, 0);
    assert.ok(b.findMove());
  }
});

test('finds horizontal and vertical runs, merges L shape into one group', () => {
  const b = fromRows([
    '0001',
    '1203',
    '3201',
    '1231',
  ]);
  const m = b.findMatches();
  assert.equal(m.groups.length, 2);
  const sizes = m.groups.map((g) => g.cells.length).sort();
  assert.deepEqual(sizes, [3, 5]);

  const l = fromRows([
    '0001',
    '0123',
    '0231',
  ]);
  const ml = l.findMatches();
  assert.equal(ml.groups.length, 1);
  assert.equal(ml.groups[0].cells.length, 5);
});

test('wouldMatch detects a valid swap', () => {
  const b = fromRows([
    '0102',
    '1323',
  ]);
  assert.ok(b.wouldMatch({ r: 0, c: 1 }, { r: 1, c: 1 }) === false);
  assert.ok(b.wouldMatch({ r: 0, c: 2 }, { r: 0, c: 1 }) === false);
  const b2 = fromRows([
    '0010',
    '2323',
  ]);
  assert.ok(b2.wouldMatch({ r: 0, c: 2 }, { r: 0, c: 3 }));
});

test('collapse fills every cell and falls land on target rows', () => {
  const b = fromRows([
    '01',
    '..',
    '2.',
  ]);
  const falls = b.collapse();
  assert.ok(b.cells.every(Boolean));
  for (const f of falls) assert.ok(f.toR > f.fromY);
  const top0 = falls.find((f) => f.tile.type === 0);
  assert.equal(top0.toR, 1);
});

test('shuffle leaves a playable board without matches', () => {
  const b = fromRows([
    '0123',
    '1230',
    '2301',
    '3012',
  ]);
  assert.equal(b.findMove(), null);
  b.shuffle();
  assert.equal(b.findMatches().groups.length, 0);
  assert.ok(b.findMove());
});
