async function callAction(invoke, data) {
  const result = await invoke(data);
  if (!result || !result.success) throw new Error(result && result.message || '迁移操作失败');
  return result.data || {};
}

async function migrateCollection(invoke, collection, onProgress) {
  let cursor = '';
  let processed = 0;
  let updated = 0;

  for (let batch = 0; batch < 1000; batch++) {
    const data = await callAction(invoke, {
      action: 'migrateCollection',
      collection,
      cursor,
    });
    processed += Number(data.processed || 0);
    updated += Number(data.updated || 0);
    onProgress({ phase: collection, processed, updated });
    if (data.done) return { processed, updated };
    if (!data.nextCursor || data.nextCursor === cursor) throw new Error('迁移游标没有前进，请检查数据');
    cursor = data.nextCursor;
  }
  throw new Error('迁移批次超过安全上限');
}

async function runPlantMigration(invoke, onProgress = () => {}) {
  onProgress({ phase: 'catalog', processed: 0, updated: 0 });
  const catalog = await callAction(invoke, { action: 'seedCatalog' });
  const plantingTasks = await migrateCollection(invoke, 'planting_tasks', onProgress);
  const careRecords = await migrateCollection(invoke, 'care_records', onProgress);
  const result = {
    seeded: Number(catalog.seeded || 0),
    planting_tasks: plantingTasks,
    care_records: careRecords,
  };
  onProgress({ phase: 'complete', ...result });
  return result;
}

module.exports = { runPlantMigration };
