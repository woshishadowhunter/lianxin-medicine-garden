const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ensureRequestId,
  filterPlants,
  getCategoryLabel,
} = require('../miniprogram/pages/plant-add/view-model');

const plants = [
  { code: 'rose', name: '月季', category: 'flower' },
  { code: 'pothos', name: '绿萝', category: 'foliage' },
  { code: 'tomato', name: '番茄', category: 'vegetable' },
];

test('filters catalog by category and trimmed keyword', () => {
  assert.deepEqual(filterPlants(plants, 'flower', ' 月 '), [plants[0]]);
  assert.deepEqual(filterPlants(plants, 'all', '绿萝'), [plants[1]]);
  assert.deepEqual(filterPlants(plants, 'vegetable', ''), [plants[2]]);
});

test('returns all catalog items when filters are empty', () => {
  assert.deepEqual(filterPlants(plants, 'all', ''), plants);
});

test('reuses an existing request id during retry', () => {
  assert.equal(ensureRequestId('plant_123', 1000, 0.5), 'plant_123');
  assert.equal(ensureRequestId('', 1000, 0.5), 'plant_1000_i');
});

test('returns a readable category label', () => {
  assert.equal(getCategoryLabel('flower'), '花卉');
  assert.equal(getCategoryLabel('unknown'), '其他');
});
