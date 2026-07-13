const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRecordDocument,
  getPlantName,
  validateRecordInput,
} = require('../cloudfunctions/submitRecord/domain');

test('builds a generic record from the server task', () => {
  const record = buildRecordDocument({
    task_id: 't1',
    family_code: 'F999',
    plant_name: '伪造名称',
    care_type: 'watering',
    photos: ['cloud://photo'],
    care_date: '2026-07-12',
    care_time: '08:30',
  }, {
    _id: 't1',
    family_code: 'F001',
    plant_code: 'rose',
    plant_name: '月季',
    plant_category: 'flower',
  });

  assert.equal(record.family_code, 'F001');
  assert.equal(record.plant_name, '月季');
  assert.equal(record.herb_name, '月季');
  assert.equal(record.plant_category, 'flower');
});

test('normalizes a legacy task when building a care record', () => {
  const record = buildRecordDocument({
    task_id: 't2',
    care_type: 'growth_check',
    photos: ['cloud://photo'],
    care_date: '2026-07-12',
  }, {
    _id: 't2',
    family_code: 'F001',
    herb_code: 'bh',
    herb_name: '薄荷',
  });

  assert.equal(record.plant_code, 'bh');
  assert.equal(record.plant_name, '薄荷');
  assert.equal(record.plant_category, 'herb');
});

test('rejects submissions without a photo', () => {
  assert.throws(() => buildRecordDocument({
    task_id: 't1',
    care_type: 'watering',
    photos: [],
    care_date: '2026-07-12',
  }, {
    _id: 't1',
    family_code: 'F001',
    plant_name: '月季',
  }), /照片/);
});

test('rejects unsupported care types and malformed dates', () => {
  assert.throws(() => validateRecordInput({
    task_id: 't1',
    care_type: 'singing',
    photos: ['cloud://photo'],
    care_date: '2026-07-12',
  }), /养护类型/);
  assert.throws(() => validateRecordInput({
    task_id: 't1',
    care_type: 'watering',
    photos: ['cloud://photo'],
    care_date: '07-12-2026',
  }), /日期/);
});

test('resolves generic, legacy, and fallback plant names', () => {
  assert.equal(getPlantName({ plant_name: '月季', herb_name: '旧名称' }), '月季');
  assert.equal(getPlantName({ herb_name: '薄荷' }), '薄荷');
  assert.equal(getPlantName({}), '植物');
});
