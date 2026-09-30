import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { targetScore } from '../config.js';

test('target scores follow the config array, then ×1.3 floored', () => {
  assert.deepEqual([1, 2, 3, 4].map(targetScore), [1500, 2500, 4000, 6000]);
  assert.equal(targetScore(5), 7800);
  assert.equal(targetScore(6), 10140);
  assert.equal(targetScore(7), Math.floor(10140 * 1.3));
});

test('characters.json levels reference known ids', () => {
  const data = JSON.parse(readFileSync(new URL('../characters.json', import.meta.url)));
  const ids = new Set(data.characters.map((c) => c.id));
  assert.equal(data.characters.length, 6);
  for (const id of data.levels.order) assert.ok(ids.has(id), id);
  assert.deepEqual(data.levels.order.slice(0, 4), ['trump', 'kim', 'musk', 'bezos']);
  assert.deepEqual(data.levels.counts, [4, 5, 6]);
});
