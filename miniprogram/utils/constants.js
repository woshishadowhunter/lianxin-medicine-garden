/* 养护类型 */
const CARE_TYPES = [
  { value: 'watering',    label: '浇水',     iconName: 'water' },
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

/* 药材生长状态 */
const HERB_STATUS = {
  growing:   { label: '生长中', iconName: 'growth' },
  harvested: { label: '已收获', iconName: 'check' },
  warning:   { label: '需关注', iconName: 'warning' },
  dead:      { label: '已枯死', iconName: 'close' },
};

/* 天气 */
const WEATHERS = ['晴天', '阴天', '雨天', '多云', '大风'];

/* 生长阶段 */
const GROWTH_STAGES = ['幼苗期', '生长期', '开花期', '结果期'];

/* 11种药材配置 */
const HERBS = [
  { code: 'jyh',  name: '金银花', iconName: 'herb', growthDays: 150 },
  { code: 'bh',   name: '薄荷',   iconName: 'herb', growthDays: 90  },
  { code: 'gq',   name: '枸杞',   iconName: 'herb', growthDays: 180 },
  { code: 'ac',   name: '艾草',   iconName: 'herb', growthDays: 120 },
  { code: 'yxc',  name: '鱼腥草', iconName: 'herb', growthDays: 100 },
  { code: 'blg',  name: '板蓝根', iconName: 'herb', growthDays: 140 },
  { code: 'pgy',  name: '蒲公英', iconName: 'herb', growthDays: 80  },
  { code: 'jh',   name: '菊花',   iconName: 'herb', growthDays: 130 },
  { code: 'zs',   name: '紫苏',   iconName: 'herb', growthDays: 100 },
  { code: 'ymc',  name: '益母草', iconName: 'herb', growthDays: 110 },
  { code: 'gc',   name: '甘草',   iconName: 'herb', growthDays: 160 },
];

/* 社区列表 */
const COMMUNITIES = ['阳光社区', '和谐社区', '幸福社区', '绿洲社区', '翠苑社区', '和风社区', '春雨社区', '金秋社区'];

module.exports = {
  CARE_TYPES,
  AUDIT_STATUS,
  HERB_STATUS,
  WEATHERS,
  GROWTH_STAGES,
  HERBS,
  COMMUNITIES,
};
