const cloud = require('wx-server-sdk');
const { CATALOG, buildRecordMigration, buildTaskMigration } = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const command = db.command;
const BATCH_SIZE = 100;

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  if (!result.data.length) throw new Error('管理员身份已失效，请重新登录');
}

async function seedCatalog() {
  for (const plant of CATALOG) {
    await db.collection('plants').doc(`plant_${plant.code}`).set({
      data: {
        ...plant,
        is_active: true,
        updated_at: db.serverDate(),
      },
    });
  }
  return { seeded: CATALOG.length };
}

async function migrateCollection(event) {
  const collectionName = event.collection;
  if (!['planting_tasks', 'care_records'].includes(collectionName)) {
    throw new Error('只支持迁移 planting_tasks 或 care_records');
  }

  let query = db.collection(collectionName);
  if (event.cursor) query = query.where({ _id: command.gt(String(event.cursor)) });
  const result = await query.orderBy('_id', 'asc').limit(BATCH_SIZE).get();
  const builder = collectionName === 'planting_tasks' ? buildTaskMigration : buildRecordMigration;
  let updated = 0;

  for (const document of result.data) {
    const data = builder(document);
    if (Object.keys(data).length) {
      await db.collection(collectionName).doc(document._id).update({
        data: { ...data, updated_at: db.serverDate() },
      });
      updated++;
    }
  }

  const last = result.data[result.data.length - 1];
  return {
    processed: result.data.length,
    updated,
    nextCursor: last ? last._id : '',
    done: result.data.length < BATCH_SIZE,
  };
}

exports.main = async (event = {}) => {
  try {
    const openid = cloud.getWXContext().OPENID;
    await assertAdmin(openid);
    switch (event.action) {
      case 'seedCatalog':
        return { success: true, data: await seedCatalog() };
      case 'migrateCollection':
        return { success: true, data: await migrateCollection(event) };
      default:
        throw new Error('未知迁移操作');
    }
  } catch (error) {
    console.error('植物数据迁移失败:', error);
    return { success: false, message: error.message };
  }
};

exports._test = { BATCH_SIZE };
