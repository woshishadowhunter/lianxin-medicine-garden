const CATEGORY_LABELS = {
  flower: '花卉',
  foliage: '绿植',
  vegetable: '蔬菜',
  fruit: '果树',
  herb: '本草',
  other: '其他',
};
const CATEGORY_ORDER = ['flower', 'foliage', 'vegetable', 'fruit', 'herb', 'other'];

function getPlantName(value = {}) {
  return value.plant_name || value.herb_name || '植物';
}

function getPlantCategory(value = {}) {
  return value.plant_category || 'herb';
}

function buildPlantStatusRows(tasks) {
  const stats = {};
  (tasks || []).forEach(task => {
    const category = getPlantCategory(task);
    const name = getPlantName(task);
    const key = `${category}:${name}`;
    if (!stats[key]) stats[key] = { category, name, growing: 0, harvested: 0, warning: 0, dead: 0 };
    if (Object.hasOwn(stats[key], task.status)) stats[key][task.status]++;
  });

  const rows = [['植物类别', '植物名称', '生长中', '已收获', '需关注', '已枯死', '总计', '存活率']];
  Object.values(stats)
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name, 'zh-CN'))
    .forEach(item => {
      const total = item.growing + item.harvested + item.warning + item.dead;
      const alive = item.growing + item.harvested;
      rows.push([
        CATEGORY_LABELS[item.category] || CATEGORY_LABELS.other,
        item.name,
        String(item.growing),
        String(item.harvested),
        String(item.warning),
        String(item.dead),
        String(total),
        total ? `${((alive / total) * 100).toFixed(1)}%` : '0.0%',
      ]);
    });
  return rows;
}

module.exports = { CATEGORY_LABELS, buildPlantStatusRows, getPlantCategory, getPlantName };
