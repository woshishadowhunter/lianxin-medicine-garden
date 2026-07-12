const cloud = require('wx-server-sdk');
const {
  buildTaskDocument,
  createCustomPlantCode,
  createTaskId,
  hash,
  validateCreateInput,
} = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function memberId(familyCode, openid) {
  return `fm_${hash(`${familyCode}:${openid}`)}`;
}

function isDocumentNotFound(error) {
  const message = String(error && (error.message || error.errMsg) || '');
  return /document.*not.*exist|not.*found|不存在/i.test(message);
}

async function assertFamilyAccess(familyCode, openid) {
  const admin = await db.collection('admins').where({ openid }).limit(1).get();
  if (admin.data.length) return;

  try {
    const member = await db.collection('family_members').doc(memberId(familyCode, openid)).get();
    if (member.data && member.data.family_code === familyCode) return;
  } catch (error) {
    if (!isDocumentNotFound(error)) throw error;
  }

  const legacy = await db.collection('families')
    .where({ family_code: familyCode, openid })
    .limit(1)
    .get();
  if (!legacy.data.length) throw new Error('无权为该家庭添加植物');
}

async function listCatalog(event) {
  const conditions = { is_active: true };
  if (event.category) conditions.category = event.category;
  const result = await db.collection('plants')
    .where(conditions)
    .limit(100)
    .get();
  return result.data.sort((a, b) => String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name), 'zh-CN'));
}

async function getExistingTask(taskId) {
  try {
    const result = await db.collection('planting_tasks').doc(taskId).get();
    return result.data || null;
  } catch (error) {
    if (isDocumentNotFound(error)) return null;
    throw error;
  }
}

async function saveTask(input, context) {
  const taskId = createTaskId(context.familyCode, input.requestId);
  const existing = await getExistingTask(taskId);
  if (existing) return { id: taskId, task: existing, duplicate: true };

  const task = buildTaskDocument(input, context);
  await db.collection('planting_tasks').doc(taskId).set({
    data: {
      ...task,
      created_at: db.serverDate(),
      updated_at: db.serverDate(),
    },
  });
  return { id: taskId, task, duplicate: false };
}

async function createPresetTask(event, openid) {
  const familyCode = String(event.familyCode || '').trim().toUpperCase();
  const requestId = String(event.requestId || '').trim();
  const plantDate = String(event.plantDate || '').trim();
  if (!/^F\d{3}$/.test(familyCode)) throw new Error('家庭编号格式不正确');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(requestId)) throw new Error('请求编号格式不正确');

  await assertFamilyAccess(familyCode, openid);
  const result = await db.collection('plants')
    .where({ code: String(event.plantCode || '').trim(), is_active: true })
    .limit(1)
    .get();
  if (!result.data.length) throw new Error('该预设植物不存在或已停用');

  const plant = result.data[0];
  const input = validateCreateInput({
    familyCode,
    requestId,
    name: String(event.nickname || '').trim() || plant.name,
    category: plant.category,
    plantDate,
    growthDays: plant.growth_days,
    coverImage: event.coverImage || '',
  }, todayString());

  return saveTask(input, {
    familyCode,
    openid,
    source: 'preset',
    plantCode: plant.code,
    iconName: plant.icon_name || 'herb',
  });
}

async function createCustomTask(event, openid) {
  const input = validateCreateInput(event, todayString());
  await assertFamilyAccess(input.familyCode, openid);
  return saveTask(input, {
    familyCode: input.familyCode,
    openid,
    source: 'custom',
    plantCode: createCustomPlantCode(input.familyCode, input.requestId),
    iconName: 'garden',
  });
}

exports.main = async (event = {}) => {
  const openid = cloud.getWXContext().OPENID;
  try {
    switch (event.action) {
      case 'listCatalog':
        return { success: true, data: await listCatalog(event) };
      case 'createPresetTask':
        return { success: true, data: await createPresetTask(event, openid) };
      case 'createCustomTask':
        return { success: true, data: await createCustomTask(event, openid) };
      default:
        throw new Error('未知植物管理操作');
    }
  } catch (error) {
    console.error('植物管理操作失败:', error);
    return { success: false, message: error.message };
  }
};

exports._test = { assertFamilyAccess, isDocumentNotFound, todayString };
