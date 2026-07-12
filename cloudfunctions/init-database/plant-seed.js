const LEGACY_HERB_CODES = ['jyh', 'bh', 'gq', 'ac', 'yxc', 'blg', 'pgy', 'jh', 'zs', 'ymc', 'gc'];

const PLANTS = [
  { code: 'rose', name: '月季', category: 'flower', icon_name: 'growth', growth_days: 120, description: '花期较长，适合观察新叶、花苞与开花变化。' },
  { code: 'sunflower', name: '向日葵', category: 'flower', icon_name: 'growth', growth_days: 100, description: '喜光植物，适合记录株高和花盘变化。' },
  { code: 'orchid', name: '兰花', category: 'flower', icon_name: 'growth', growth_days: 0, description: '多年生观赏植物，注意通风和适度浇水。' },
  { code: 'pothos', name: '绿萝', category: 'foliage', icon_name: 'garden', growth_days: 0, description: '常见室内绿植，适合记录新叶和藤蔓生长。' },
  { code: 'monstera', name: '龟背竹', category: 'foliage', icon_name: 'garden', growth_days: 0, description: '大型观叶植物，适合观察开背和叶片状态。' },
  { code: 'tomato', name: '番茄', category: 'vegetable', icon_name: 'herb', growth_days: 110, description: '可记录育苗、开花、坐果和成熟过程。' },
  { code: 'lettuce', name: '生菜', category: 'vegetable', icon_name: 'herb', growth_days: 55, description: '生长周期较短，适合家庭阳台种植。' },
  { code: 'pepper', name: '辣椒', category: 'vegetable', icon_name: 'herb', growth_days: 120, description: '适合记录开花、结果和果实变色。' },
  { code: 'strawberry', name: '草莓', category: 'fruit', icon_name: 'growth', growth_days: 120, description: '可记录花朵、幼果和成熟果实。' },
  { code: 'lemon', name: '柠檬', category: 'fruit', icon_name: 'growth', growth_days: 0, description: '多年生果树，适合长期观察抽枝和结果。' },
  { code: 'jyh', name: '金银花', category: 'herb', icon_name: 'herb', growth_days: 150, description: '' },
  { code: 'bh', name: '薄荷', category: 'herb', icon_name: 'herb', growth_days: 90, description: '' },
  { code: 'gq', name: '枸杞', category: 'herb', icon_name: 'herb', growth_days: 180, description: '' },
  { code: 'ac', name: '艾草', category: 'herb', icon_name: 'herb', growth_days: 120, description: '' },
  { code: 'yxc', name: '鱼腥草', category: 'herb', icon_name: 'herb', growth_days: 100, description: '' },
  { code: 'blg', name: '板蓝根', category: 'herb', icon_name: 'herb', growth_days: 140, description: '' },
  { code: 'pgy', name: '蒲公英', category: 'herb', icon_name: 'herb', growth_days: 80, description: '' },
  { code: 'jh', name: '菊花', category: 'herb', icon_name: 'herb', growth_days: 130, description: '' },
  { code: 'zs', name: '紫苏', category: 'herb', icon_name: 'herb', growth_days: 100, description: '' },
  { code: 'ymc', name: '益母草', category: 'herb', icon_name: 'herb', growth_days: 110, description: '' },
  { code: 'gc', name: '甘草', category: 'herb', icon_name: 'herb', growth_days: 160, description: '' },
  { code: 'succulent', name: '多肉植物', category: 'other', icon_name: 'garden', growth_days: 0, description: '可记录叶片状态、换盆和侧芽生长。' },
];

function buildSeedTask(familyCode, plant, plantDate) {
  return {
    family_code: familyCode,
    plant_code: plant.code,
    plant_name: plant.name,
    plant_category: plant.category,
    plant_icon_name: plant.icon_name,
    growth_days: plant.growth_days,
    source: 'preset',
    cover_image: '',
    owner_openid: '',
    herb_code: plant.code,
    herb_name: plant.name,
    herb_icon: '',
    herb_icon_name: plant.icon_name,
    plant_date: plantDate,
    status: 'growing',
    care_count: 0,
    last_care_date: '',
    last_care_type: '',
  };
}

module.exports = { LEGACY_HERB_CODES, PLANTS, buildSeedTask };
