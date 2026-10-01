import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetScore } from '../config.js';

test('target scores start at base and grow by a fixed step', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(targetScore), [1000, 1250, 1500, 1750, 2000]);
  assert.equal(targetScore(20), 1000 + 250 * 19);
});

test('characters.json levels reference known ids', () => {
  const data = JSON.parse(readFileSync(new URL('../characters.json', import.meta.url)));
  const ids = new Set(data.characters.map((c) => c.id));
  assert.equal(data.characters.length, 8);
  for (const id of data.levels.order) assert.ok(ids.has(id), id);
  assert.deepEqual(data.levels.order.slice(0, 4), ['trump', 'kim', 'musk', 'bezos']);
  assert.deepEqual(data.levels.counts, [4, 5, 6]);
});
