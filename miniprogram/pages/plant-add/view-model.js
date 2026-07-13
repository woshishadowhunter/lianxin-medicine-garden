const CATEGORY_LABELS = {
  flower: '花卉',
  foliage: '绿植',
  vegetable: '蔬菜',
  fruit: '果树',
  herb: '本草',
  other: '其他',
};

function filterPlants(plants, category = 'all', keyword = '') {
  const query = String(keyword || '').trim().toLowerCase();
  return (plants || []).filter(plant => {
    const categoryMatches = category === 'all' || plant.category === category;
    const keywordMatches = !query || String(plant.name || '').toLowerCase().includes(query);
    return categoryMatches && keywordMatches;
  });
}

function ensureRequestId(current, now = Date.now(), random = Math.random()) {
  if (current) return current;
  return `plant_${now}_${random.toString(36).slice(2, 3)}`;
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
}

module.exports = { CATEGORY_LABELS, ensureRequestId, filterPlants, getCategoryLabel };
