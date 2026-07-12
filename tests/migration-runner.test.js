const test = require('node:test');
const assert = require('node:assert/strict');

const { runPlantMigration } = require('../miniprogram/pages/admin/export/migration');

test('seeds catalog and migrates both collections until complete', async () => {
  const calls = [];
  const cursors = { planting_tasks: 0, care_records: 0 };
  const invoke = async data => {
    calls.push(data);
    if (data.action === 'seedCatalog') return { success: true, data: { seeded: 22 } };
    const batch = cursors[data.collection]++;
    return {
      success: true,
      data: batch === 0
        ? { processed: 100, updated: 90, nextCursor: `${data.collection}-100`, done: false }
        : { processed: 20, updated: 10, nextCursor: `${data.collection}-120`, done: true },
    };
  };
  const progress = [];

  const result = await runPlantMigration(invoke, value => progress.push(value));

  assert.equal(result.seeded, 22);
  assert.deepEqual(result.planting_tasks, { processed: 120, updated: 100 });
  assert.deepEqual(result.care_records, { processed: 120, updated: 100 });
  assert.equal(calls.length, 5);
  assert.equal(progress.at(-1).phase, 'complete');
});

test('stops when a cloud action fails', async () => {
  await assert.rejects(
    () => runPlantMigration(async () => ({ success: false, message: '管理员身份失效' })),
    /管理员身份失效/,
  );
});
