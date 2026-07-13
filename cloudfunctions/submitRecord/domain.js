const crypto = require('crypto');

const CARE_TYPES = ['watering', 'pruning', 'fertilizing', 'weeding', 'pest_control', 'growth_check', 'other'];

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function getPlantName(value = {}) {
  return value.plant_name || value.herb_name || '植物';
}

function normalizeTask(task = {}) {
  return {
    ...task,
    plant_code: task.plant_code || task.herb_code || '',
    plant_name: getPlantName(task),
    plant_category: task.plant_category || 'herb',
  };
}

function validateRecordInput(event = {}) {
  const taskId = String(event.task_id || '').trim();
  const careType = String(event.care_type || '').trim();
  const photos = Array.isArray(event.photos) ? event.photos.filter(Boolean) : [];
  const careDate = String(event.care_date || '').trim();

  if (!taskId) throw new Error('缺少种植任务');
  if (!CARE_TYPES.includes(careType)) throw new Error('请选择有效的养护类型');
  if (!photos.length || photos.length > 9) throw new Error('每条记录须包含 1 至 9 张照片');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(careDate)) throw new Error('养护日期格式不正确');

  return {
    taskId,
    careType,
    photos,
    careDate,
    careTime: String(event.care_time || '').trim(),
    description: String(event.description || '').trim().slice(0, 200),
    weather: String(event.weather || '').trim().slice(0, 20),
    growthStage: String(event.growth_stage || '').trim().slice(0, 30),
  };
}

function buildRecordDocument(event, task) {
  const input = validateRecordInput(event);
  const plant = normalizeTask(task);
  return {
    family_code: plant.family_code,
    task_id: input.taskId,
    plant_code: plant.plant_code,
    plant_name: plant.plant_name,
    plant_category: plant.plant_category,
    herb_code: plant.plant_code,
    herb_name: plant.plant_name,
    care_type: input.careType,
    photos: input.photos,
    description: input.description,
    weather: input.weather,
    growth_stage: input.growthStage,
    care_date: input.careDate,
    care_time: input.careTime,
    audit_status: 'pending',
    audit_comment: '',
    points_status: 'none',
    points_sequence: 0,
  };
}

module.exports = {
  CARE_TYPES,
  buildRecordDocument,
  getPlantName,
  hash,
  normalizeTask,
  validateRecordInput,
};
