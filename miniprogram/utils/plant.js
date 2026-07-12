const CATEGORY_VALUES = ['flower', 'foliage', 'vegetable', 'fruit', 'herb', 'other'];

function getPlantDisplayName(value = {}) {
  return value.plant_name || value.herb_name || '植物';
}

function normalizePlantTask(task = {}) {
  return {
    ...task,
    plant_code: task.plant_code || task.herb_code || '',
    plant_name: getPlantDisplayName(task),
    plant_category: task.plant_category || 'herb',
    plant_icon_name: task.plant_icon_name || task.herb_icon_name || 'herb',
    growth_days: Number(task.growth_days || 0),
    source: task.source || 'legacy',
    cover_image: task.cover_image || '',
  };
}

function normalizePlantRecord(record = {}) {
  return {
    ...record,
    plant_code: record.plant_code || record.herb_code || '',
    plant_name: getPlantDisplayName(record),
    plant_category: record.plant_category || 'herb',
  };
}

function validatePlantInput(input = {}, today) {
  const name = String(input.name || '').trim();
  if (!name || name.length > 30) {
    throw new Error('植物名称须为 1 至 30 个字符');
  }
  if (!CATEGORY_VALUES.includes(input.category)) {
    throw new Error('请选择有效的植物类别');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.plantDate || '') || input.plantDate > today) {
    throw new Error('种植日期不能晚于今天');
  }

  const growthDays = Number(input.growthDays || 0);
  if (!Number.isInteger(growthDays) || growthDays < 0 || growthDays > 3650) {
    throw new Error('成长周期须为 0 至 3650 天');
  }

  return {
    name,
    category: input.category,
    plantDate: input.plantDate,
    growthDays,
  };
}

module.exports = {
  CATEGORY_VALUES,
  getPlantDisplayName,
  normalizePlantTask,
  normalizePlantRecord,
  validatePlantInput,
};
