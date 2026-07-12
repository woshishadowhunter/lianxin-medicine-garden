const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTaskDocument,
  createCustomPlantCode,
  createTaskId,
  validateCreateInput,
} = require('../cloudfunctions/plantManager/domain');

test('builds compatibility fields for a custom flower', () => {
  const task = buildTaskDocument({
    name: '月季',
    category: 'flower',
    plantDate: '2026-07-01',
    growthDays: 120,
    coverImage: 'cloud://cover',
  }, {
    familyCode: 'F001',
    openid: 'o1',
    source: 'custom',
    plantCode: 'custom_1',
  });

  assert.equal(task.plant_name, '月季');
  assert.equal(task.herb_name, '月季');
  assert.equal(task.plant_category, 'flower');
  assert.equal(task.owner_openid, 'o1');
  assert.equal(task.cover_image, 'cloud://cover');
  assert.equal(task.status, 'growing');
});

test('creates deterministic and family-scoped task ids for retries', () => {
  assert.equal(createTaskId('F001', 'request-1'), createTaskId('F001', 'request-1'));
  assert.notEqual(createTaskId('F001', 'request-1'), createTaskId('F001', 'request-2'));
  assert.notEqual(createTaskId('F001', 'request-1'), createTaskId('F002', 'request-1'));
});

test('creates deterministic custom plant codes from task identity', () => {
  const code = createCustomPlantCode('F001', 'request-1');
  assert.match(code, /^custom_[a-f0-9]{16}$/);
  assert.equal(code, createCustomPlantCode('F001', 'request-1'));
});

test('validates request id and normalizes valid create input', () => {
  const value = validateCreateInput({
    familyCode: 'f001',
    requestId: ' create-001 ',
    name: ' 月季 ',
    category: 'flower',
    plantDate: '2026-07-01',
    growthDays: '120',
    coverImage: 'cloud://cover',
  }, '2026-07-12');

  assert.deepEqual(value, {
    familyCode: 'F001',
    requestId: 'create-001',
    name: '月季',
    category: 'flower',
    plantDate: '2026-07-01',
    growthDays: 120,
    coverImage: 'cloud://cover',
  });
});

test('rejects malformed family and request identifiers', () => {
  const valid = {
    familyCode: 'F001',
    requestId: 'create-001',
    name: '月季',
    category: 'flower',
    plantDate: '2026-07-01',
    growthDays: 120,
  };

  assert.throws(() => validateCreateInput({ ...valid, familyCode: '001' }, '2026-07-12'), /家庭编号/);
  assert.throws(() => validateCreateInput({ ...valid, requestId: '' }, '2026-07-12'), /请求编号/);
});
