/* 养护类型 */
const CARE_TYPES = [
  { value: 'watering',    label: '浇水',     iconName: 'water' },
  { value: 'pruning',     label: '修剪',     iconName: 'growth' },
  { value: 'weeding',     label: '除草',     iconName: 'weed' },
  { value: 'fertilizing', label: '施肥',     iconName: 'fertilize' },
  { value: 'pest_control',label: '除虫',     iconName: 'pest' },
  { value: 'growth_check',label: '生长确认', iconName: 'camera' },
  { value: 'other',       label: '其他',     iconName: 'record' },
];

/* 审核状态 */
const AUDIT_STATUS = {
  pending:        { label: '待审核', color: 'tag-pending' },
  confirmed:      { label: '已确认', color: 'tag-confirmed' },
  needs_revision: { label: '需修正', color: 'tag-revision' },
};

/* 植物生长状态 */
const PLANT_STATUS = {
  growing:   { label: '生长中', iconName: 'growth' },
  harvested: { label: '已收获', iconName: 'check' },
  warning:   { label: '需关注', iconName: 'warning' },
  dead:      { label: '已枯死', iconName: 'close' },
};

const HERB_STATUS = PLANT_STATUS;

/* 天气 */
const WEATHERS = ['晴天', '阴天', '雨天', '多云', '大风'];

/* 生长阶段 */
const GROWTH_STAGES = ['幼苗期', '生长期', '开花期', '结果期', '休眠期'];

const PLANT_CATEGORIES = [
  { value: 'flower', label: '花卉', iconName: 'growth' },
  { value: 'foliage', label: '绿植', iconName: 'garden' },
  { value: 'vegetable', label: '蔬菜', iconName: 'herb' },
  { value: 'fruit', label: '果树', iconName: 'growth' },
  { value: 'herb', label: '本草', iconName: 'herb' },
  { value: 'other', label: '其他', iconName: 'garden' },
];

/* 预设植物库；保留原有 11 种本草并覆盖常见家庭植物。 */
const PRESET_PLANTS = [
  { code: 'rose', name: '月季', category: 'flower', iconName: 'growth', growthDays: 120 },
  { code: 'sunflower', name: '向日葵', category: 'flower', iconName: 'growth', growthDays: 100 },
  { code: 'orchid', name: '兰花', category: 'flower', iconName: 'growth', growthDays: 0 },
  { code: 'pothos', name: '绿萝', category: 'foliage', iconName: 'garden', growthDays: 0 },
  { code: 'monstera', name: '龟背竹', category: 'foliage', iconName: 'garden', growthDays: 0 },
  { code: 'tomato', name: '番茄', category: 'vegetable', iconName: 'herb', growthDays: 110 },
  { code: 'lettuce', name: '生菜', category: 'vegetable', iconName: 'herb', growthDays: 55 },
  { code: 'pepper', name: '辣椒', category: 'vegetable', iconName: 'herb', growthDays: 120 },
  { code: 'strawberry', name: '草莓', category: 'fruit', iconName: 'growth', growthDays: 120 },
  { code: 'lemon', name: '柠檬', category: 'fruit', iconName: 'growth', growthDays: 0 },
  { code: 'jyh', name: '金银花', category: 'herb', iconName: 'herb', growthDays: 150 },
  { code: 'bh', name: '薄荷', category: 'herb', iconName: 'herb', growthDays: 90 },
  { code: 'gq', name: '枸杞', category: 'herb', iconName: 'herb', growthDays: 180 },
  { code: 'ac', name: '艾草', category: 'herb', iconName: 'herb', growthDays: 120 },
  { code: 'yxc', name: '鱼腥草', category: 'herb', iconName: 'herb', growthDays: 100 },
  { code: 'blg', name: '板蓝根', category: 'herb', iconName: 'herb', growthDays: 140 },
  { code: 'pgy', name: '蒲公英', category: 'herb', iconName: 'herb', growthDays: 80 },
  { code: 'jh', name: '菊花', category: 'herb', iconName: 'herb', growthDays: 130 },
  { code: 'zs', name: '紫苏', category: 'herb', iconName: 'herb', growthDays: 100 },
  { code: 'ymc', name: '益母草', category: 'herb', iconName: 'herb', growthDays: 110 },
  { code: 'gc', name: '甘草', category: 'herb', iconName: 'herb', growthDays: 160 },
  { code: 'succulent', name: '多肉植物', category: 'other', iconName: 'garden', growthDays: 0 },
];

const HERBS = PRESET_PLANTS.filter(plant => plant.category === 'herb');

/* 社区列表 */
const COMMUNITIES = ['阳光社区', '和谐社区', '幸福社区', '绿洲社区', '翠苑社区', '和风社区', '春雨社区', '金秋社区'];

module.exports = {
  CARE_TYPES,
  AUDIT_STATUS,
  PLANT_STATUS,
  HERB_STATUS,
  WEATHERS,
  GROWTH_STAGES,
  PLANT_CATEGORIES,
  PRESET_PLANTS,
  HERBS,
  COMMUNITIES,
};
