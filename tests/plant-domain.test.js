const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePlantTask,
  normalizePlantRecord,
  validatePlantInput,
  getPlantDisplayName,
} = require('../miniprogram/utils/plant');

test('normalizes a legacy herb task without losing its identity', () => {
  const task = normalizePlantTask({
    herb_code: 'bh',
    herb_name: '薄荷',
    herb_icon_name: 'herb',
    plant_date: '2026-04-20',
  });

  assert.equal(task.plant_code, 'bh');
  assert.equal(task.plant_name, '薄荷');
  assert.equal(task.plant_category, 'herb');
  assert.equal(task.source, 'legacy');
  assert.equal(task.plant_icon_name, 'herb');
});

test('preserves generic fields on a new plant task', () => {
  const task = normalizePlantTask({
    plant_code: 'rose',
    plant_name: '月季',
    plant_category: 'flower',
    plant_icon_name: 'flower',
    growth_days: 120,
    source: 'preset',
  });

  assert.equal(task.plant_name, '月季');
  assert.equal(task.plant_category, 'flower');
  assert.equal(task.growth_days, 120);
  assert.equal(task.source, 'preset');
});

test('normalizes a legacy care record for generic views', () => {
  const record = normalizePlantRecord({ herb_code: 'gq', herb_name: '枸杞' });

  assert.equal(record.plant_code, 'gq');
  assert.equal(record.plant_name, '枸杞');
  assert.equal(record.plant_category, 'herb');
});

test('returns a safe display name from new and legacy values', () => {
  assert.equal(getPlantDisplayName({ plant_name: '月季', herb_name: '旧名称' }), '月季');
  assert.equal(getPlantDisplayName({ herb_name: '薄荷' }), '薄荷');
  assert.equal(getPlantDisplayName({}), '植物');
});

test('rejects future planting dates and invalid categories', () => {
  assert.throws(() => validatePlantInput({
    name: '月季',
    category: 'tree',
    plantDate: '2026-07-01',
    growthDays: 120,
  }, '2026-07-12'), /类别/);

  assert.throws(() => validatePlantInput({
    name: '月季',
    category: 'flower',
    plantDate: '2026-07-13',
    growthDays: 120,
  }, '2026-07-12'), /日期/);
});

test('trims valid plant input and allows no fixed growth cycle', () => {
  const value = validatePlantInput({
    name: '  绿萝  ',
    category: 'foliage',
    plantDate: '2026-07-01',
    growthDays: 0,
  }, '2026-07-12');

  assert.deepEqual(value, {
    name: '绿萝',
    category: 'foliage',
    plantDate: '2026-07-01',
    growthDays: 0,
  });
});
