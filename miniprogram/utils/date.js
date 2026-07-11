/** 日期格式化 */
function formatDate(date, fmt = 'YYYY-MM-DD') {
  if (typeof date === 'string') date = new Date(date);
  if (!(date instanceof Date) || isNaN(date)) return '';

  const map = {
    YYYY: date.getFullYear(),
    MM: String(date.getMonth() + 1).padStart(2, '0'),
    DD: String(date.getDate()).padStart(2, '0'),
    hh: String(date.getHours()).padStart(2, '0'),
    mm: String(date.getMinutes()).padStart(2, '0'),
    ss: String(date.getSeconds()).padStart(2, '0'),
  };

  return fmt.replace(/YYYY|MM|DD|hh|mm|ss/g, (k) => map[k]);
}

/** 相对时间描述 */
function timeAgo(dateStr) {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1)  return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24)   return `${hours}小时前`;
  if (days < 7)     return `${days}天前`;
  return formatDate(dateStr);
}

/** 获取日期范围内的天数数组 */
function getDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  while (start <= end) {
    dates.push(formatDate(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

/** 计算距预计收获还有多少天 */
function daysUntilHarvest(plantDate, growthDays) {
  const plant = new Date(plantDate);
  const harvest = new Date(plant);
  harvest.setDate(harvest.getDate() + growthDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  harvest.setHours(0, 0, 0, 0);
  const diff = Math.ceil((harvest - today) / 86400000);
  return Math.max(0, diff);
}

/** 生成唯一 ID */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  formatDate,
  timeAgo,
  getDateRange,
  daysUntilHarvest,
  generateId,
};
