import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetScore } from '../config.js';

test('target scores start at base and grow by a fixed step', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(targetScore), [1000, 1100, 1200, 1300, 1400]);
  assert.equal(targetScore(20), 1000 + 100 * 19);
});

test('characters.json levels reference known ids', async () => {
  const data = JSON.parse(readFileSync(new URL('../characters.json', import.meta.url)));
  const ids = new Set(data.characters.map((c) => c.id));
  assert.equal(data.characters.length, 8);
  for (const id of data.levels.order) assert.ok(ids.has(id), id);
  assert.deepEqual(data.levels.order.slice(0, 4), ['trump', 'kim', 'musk', 'bezos']);
  const { typeCount } = await import('../js/game.js');
  assert.deepEqual([1, 2, 10, 11, 20, 21, 50].map((l) => typeCount(data.levels, l, 8)), [4, 4, 4, 5, 5, 6, 6]);
});
