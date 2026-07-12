const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPlantStatusRows,
  getPlantCategory,
  getPlantName,
} = require('../cloudfunctions/exportData/domain');

test('reads generic and legacy plant names', () => {
  assert.equal(getPlantName({ plant_name: '月季', herb_name: '旧名称' }), '月季');
  assert.equal(getPlantName({ herb_name: '薄荷' }), '薄荷');
  assert.equal(getPlantName({}), '植物');
});

test('uses herb as the legacy category fallback', () => {
  assert.equal(getPlantCategory({ plant_category: 'flower' }), 'flower');
  assert.equal(getPlantCategory({ herb_name: '薄荷' }), 'herb');
});

test('groups plant status rows by category and plant name', () => {
  const rows = buildPlantStatusRows([
    { herb_name: '薄荷', status: 'growing' },
    { plant_name: '月季', plant_category: 'flower', status: 'warning' },
    { plant_name: '月季', plant_category: 'flower', status: 'growing' },
  ]);

  assert.deepEqual(rows[0], ['植物类别', '植物名称', '生长中', '已收获', '需关注', '已枯死', '总计', '存活率']);
  assert.deepEqual(rows[1], ['花卉', '月季', '1', '0', '1', '0', '2', '50.0%']);
  assert.deepEqual(rows[2], ['本草', '薄荷', '1', '0', '0', '0', '1', '100.0%']);
});
