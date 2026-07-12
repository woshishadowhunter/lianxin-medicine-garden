const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEGACY_HERB_CODES,
  PLANTS,
  buildSeedTask,
} = require('../cloudfunctions/init-database/plant-seed');
const {
  CATALOG,
  buildRecordMigration,
  buildTaskMigration,
} = require('../cloudfunctions/migratePlants/domain');

test('preset catalog covers every supported plant category', () => {
  const categories = new Set(PLANTS.map(plant => plant.category));
  assert.deepEqual([...categories].sort(), ['flower', 'foliage', 'fruit', 'herb', 'other', 'vegetable']);
});

test('preset catalog keeps all eleven legacy herbs and unique codes', () => {
  const codes = PLANTS.map(plant => plant.code);
  assert.equal(new Set(codes).size, codes.length);
  LEGACY_HERB_CODES.forEach(code => assert.ok(codes.includes(code), `missing ${code}`));
  assert.equal(LEGACY_HERB_CODES.length, 11);
});

test('seed task writes generic and legacy compatibility fields', () => {
  const plant = PLANTS.find(item => item.code === 'rose');
  const task = buildSeedTask('F001', plant, '2026-04-20');

  assert.equal(task.plant_code, 'rose');
  assert.equal(task.plant_name, '月季');
  assert.equal(task.plant_category, 'flower');
  assert.equal(task.herb_code, 'rose');
  assert.equal(task.herb_name, '月季');
  assert.equal(task.source, 'preset');
});

test('legacy task migration fills only generic plant fields', () => {
  const update = buildTaskMigration({
    herb_code: 'bh',
    herb_name: '薄荷',
    herb_icon_name: 'herb',
  });

  assert.deepEqual(update, {
    plant_code: 'bh',
    plant_name: '薄荷',
    plant_category: 'herb',
    plant_icon_name: 'herb',
    growth_days: 0,
    source: 'legacy',
    cover_image: '',
  });
});

test('record migration keeps an existing generic category', () => {
  const update = buildRecordMigration({
    herb_code: 'rose',
    herb_name: '月季',
    plant_category: 'flower',
  });

  assert.deepEqual(update, {
    plant_code: 'rose',
    plant_name: '月季',
  });
});

test('migration catalog matches the initializer catalog', () => {
  assert.deepEqual(CATALOG.map(plant => plant.code), PLANTS.map(plant => plant.code));
});
