const crypto = require('crypto');

const CATEGORY_VALUES = ['flower', 'foliage', 'vegetable', 'fruit', 'herb', 'other'];

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function createTaskId(familyCode, requestId) {
  return `plant_${hash(`${familyCode}:${requestId}`).slice(0, 24)}`;
}

function createCustomPlantCode(familyCode, requestId) {
  return `custom_${hash(`${familyCode}:${requestId}`).slice(0, 16)}`;
}

function validateCreateInput(input = {}, today) {
  const familyCode = String(input.familyCode || '').trim().toUpperCase();
  const requestId = String(input.requestId || '').trim();
  const name = String(input.name || '').trim();
  const category = String(input.category || '').trim();
  const plantDate = String(input.plantDate || '').trim();
  const growthDays = Number(input.growthDays || 0);
  const coverImage = String(input.coverImage || '').trim();

  if (!/^F\d{3}$/.test(familyCode)) throw new Error('家庭编号格式不正确');
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(requestId)) throw new Error('请求编号格式不正确');
  if (!name || name.length > 30) throw new Error('植物名称须为 1 至 30 个字符');
  if (!CATEGORY_VALUES.includes(category)) throw new Error('请选择有效的植物类别');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plantDate) || plantDate > today) {
    throw new Error('种植日期不能晚于今天');
  }
  if (!Number.isInteger(growthDays) || growthDays < 0 || growthDays > 3650) {
    throw new Error('成长周期须为 0 至 3650 天');
  }
  if (coverImage && (!coverImage.startsWith('cloud://') || coverImage.length > 512)) {
    throw new Error('封面图片地址无效');
  }

  return { familyCode, requestId, name, category, plantDate, growthDays, coverImage };
}

function buildTaskDocument(input, context) {
  const iconName = context.iconName || 'herb';
  return {
    family_code: context.familyCode,
    plant_code: context.plantCode,
    plant_name: input.name,
    plant_category: input.category,
    plant_icon_name: iconName,
    growth_days: input.growthDays,
    source: context.source,
    cover_image: input.coverImage || '',
    owner_openid: context.openid,
    herb_code: context.plantCode,
    herb_name: input.name,
    herb_icon: '',
    herb_icon_name: iconName,
    plant_date: input.plantDate,
    status: 'growing',
    care_count: 0,
    last_care_date: '',
    last_care_type: '',
  };
}

module.exports = {
  CATEGORY_VALUES,
  buildTaskDocument,
  createCustomPlantCode,
  createTaskId,
  hash,
  validateCreateInput,
};
