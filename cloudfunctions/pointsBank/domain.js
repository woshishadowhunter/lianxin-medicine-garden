const REDEMPTION_CATALOG = [
  {
    code: 'seed_pack',
    name: '四季种子包',
    points: 60,
    description: '适合家庭阳台播种的应季种子组合',
    stock: 40,
    icon: 'growth',
  },
  {
    code: 'garden_gloves',
    name: '儿童园艺手套',
    points: 120,
    description: '一双轻便耐磨的儿童园艺手套',
    stock: 30,
    icon: 'star',
  },
  {
    code: 'watering_can',
    name: '迷你浇水壶',
    points: 180,
    description: '适合家庭小盆栽使用的轻量浇水壶',
    stock: 20,
    icon: 'water',
  },
  {
    code: 'family_kit',
    name: '家庭种植礼包',
    points: 300,
    description: '种子、营养土与种植标签组合礼包',
    stock: 12,
    icon: 'garden',
  },
];

const FULFILLMENT_DAYS = 7;
const STATUS_TRANSITIONS = {
  pending: ['ready', 'canceled'],
  ready: ['fulfilled', 'canceled'],
  fulfilled: [],
  canceled: [],
};

function getCatalogItem(code) {
  return REDEMPTION_CATALOG.find(item => item.code === code) || null;
}

function validateRedemptionInput(input) {
  const familyCode = String(input.familyCode || '').trim().toUpperCase();
  const rewardCode = String(input.rewardCode || '').trim();
  const requestId = String(input.requestId || '').trim();
  const quantity = Number(input.quantity || 1);

  if (!/^F\d{3}$/.test(familyCode)) throw new Error('家庭编号格式不正确');
  if (!getCatalogItem(rewardCode)) throw new Error('兑换项目不存在或已下架');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) throw new Error('兑换请求编号格式不正确');
  if (quantity !== 1) throw new Error('每次只能兑换一份礼品');

  return { familyCode, rewardCode, requestId, quantity };
}

function calculateRedemption(balance, stockAvailable, reward, quantity = 1) {
  const pointsCost = reward.points * quantity;
  if (Number(stockAvailable || 0) < quantity) throw new Error('礼品库存不足');
  if (Number(balance || 0) < pointsCost) throw new Error('可用积分不足');
  return { pointsCost, balanceAfter: Number(balance) - pointsCost };
}

function assertStatusTransition(currentStatus, nextStatus) {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) throw new Error('当前兑换状态不能执行该操作');
  return nextStatus;
}

function assertIdempotentMatch(existing, expected, fields) {
  const mismatch = fields.some(field => String(existing[field]) !== String(expected[field]));
  if (mismatch) throw new Error('请求编号已用于其他操作，请刷新后重试');
  return true;
}

function assertReservedStock(stock, quantity) {
  if (Number(stock.reserved || 0) < quantity) throw new Error('预留库存异常，请先核对库存台账');
  return true;
}

function calculateAccountUpdate(account, amount, metric) {
  const balanceAfter = Number(account.balance || 0) + amount;
  if (balanceAfter < 0 && metric !== 'reversed') throw new Error('账户余额不足，不能执行扣减');

  return {
    balance: balanceAfter,
    total_earned: Number(account.total_earned || 0) + (metric === 'earned' ? Math.max(amount, 0) : 0),
    total_reversed: Number(account.total_reversed || 0) + (metric === 'reversed' ? Math.abs(amount) : 0),
    total_redeemed: Number(account.total_redeemed || 0) + (metric === 'redeemed' ? Math.abs(amount) : 0),
    total_refunded: Number(account.total_refunded || 0) + (metric === 'refunded' ? Math.max(amount, 0) : 0),
    transaction_count: Number(account.transaction_count || 0) + 1,
    version: Number(account.version || 0) + 1,
  };
}

function getDueAt(now = new Date()) {
  return new Date(now.getTime() + FULFILLMENT_DAYS * 24 * 60 * 60 * 1000);
}

function isOverdue(redemption, now = new Date()) {
  if (redemption.status !== 'pending') return false;
  const dueAt = new Date(redemption.due_at);
  return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < now.getTime();
}

module.exports = {
  REDEMPTION_CATALOG,
  FULFILLMENT_DAYS,
  STATUS_TRANSITIONS,
  getCatalogItem,
  validateRedemptionInput,
  calculateRedemption,
  assertStatusTransition,
  assertIdempotentMatch,
  assertReservedStock,
  calculateAccountUpdate,
  getDueAt,
  isOverdue,
};
