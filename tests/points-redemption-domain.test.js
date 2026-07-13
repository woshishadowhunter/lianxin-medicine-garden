const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REDEMPTION_CATALOG,
  validateRedemptionInput,
  calculateRedemption,
  assertStatusTransition,
  assertIdempotentMatch,
  assertReservedStock,
  calculateAccountUpdate,
  getDueAt,
  isOverdue,
} = require('../cloudfunctions/pointsBank/domain');

test('redemption catalog has unique codes and positive stock and points', () => {
  assert.equal(new Set(REDEMPTION_CATALOG.map(item => item.code)).size, REDEMPTION_CATALOG.length);
  REDEMPTION_CATALOG.forEach(item => {
    assert.ok(item.points > 0);
    assert.ok(item.stock > 0);
  });
});

test('validates a family redemption request', () => {
  assert.deepEqual(validateRedemptionInput({
    familyCode: 'f001',
    rewardCode: 'seed_pack',
    requestId: 'redeem_12345678',
  }), {
    familyCode: 'F001',
    rewardCode: 'seed_pack',
    requestId: 'redeem_12345678',
    quantity: 1,
  });
});

test('rejects unknown rewards and multiple-item requests', () => {
  assert.throws(() => validateRedemptionInput({ familyCode: 'F001', rewardCode: 'missing', requestId: 'request_1234' }), /不存在/);
  assert.throws(() => validateRedemptionInput({ familyCode: 'F001', rewardCode: 'seed_pack', requestId: 'request_1234', quantity: 2 }), /一份/);
});

test('calculates a redemption and guards balance and stock', () => {
  const reward = REDEMPTION_CATALOG[0];
  assert.deepEqual(calculateRedemption(100, 4, reward), { pointsCost: 60, balanceAfter: 40 });
  assert.throws(() => calculateRedemption(20, 4, reward), /积分不足/);
  assert.throws(() => calculateRedemption(100, 0, reward), /库存不足/);
});

test('allows only the fulfillment state machine transitions', () => {
  assert.equal(assertStatusTransition('pending', 'ready'), 'ready');
  assert.equal(assertStatusTransition('ready', 'fulfilled'), 'fulfilled');
  assert.equal(assertStatusTransition('ready', 'canceled'), 'canceled');
  assert.throws(() => assertStatusTransition('fulfilled', 'canceled'), /不能执行/);
  assert.throws(() => assertStatusTransition('pending', 'fulfilled'), /不能执行/);
});

test('rejects idempotency conflicts and reserved-stock underflow', () => {
  assert.equal(assertIdempotentMatch(
    { family_code: 'F001', reward_code: 'seed_pack', quantity: 1 },
    { family_code: 'F001', reward_code: 'seed_pack', quantity: 1 },
    ['family_code', 'reward_code', 'quantity'],
  ), true);
  assert.throws(() => assertIdempotentMatch(
    { family_code: 'F001', reward_code: 'seed_pack' },
    { family_code: 'F001', reward_code: 'watering_can' },
    ['family_code', 'reward_code'],
  ), /其他操作/);
  assert.equal(assertReservedStock({ reserved: 2 }, 1), true);
  assert.throws(() => assertReservedStock({ reserved: 0 }, 1), /预留库存异常/);
});

test('keeps earning, redemption, reversal, and refund totals separate', () => {
  const account = { balance: 200, total_earned: 200, total_reversed: 0, total_redeemed: 0, total_refunded: 0, transaction_count: 2, version: 2 };
  const redeemed = calculateAccountUpdate(account, -60, 'redeemed');
  assert.equal(redeemed.balance, 140);
  assert.equal(redeemed.total_earned, 200);
  assert.equal(redeemed.total_redeemed, 60);

  const refunded = calculateAccountUpdate(redeemed, 60, 'refunded');
  assert.equal(refunded.balance, 200);
  assert.equal(refunded.total_refunded, 60);
  assert.equal(refunded.total_earned, 200);

  const reversed = calculateAccountUpdate({ balance: 0 }, -10, 'reversed');
  assert.equal(reversed.balance, -10);
  assert.equal(reversed.total_reversed, 10);
  assert.throws(() => calculateAccountUpdate({ balance: 0 }, -10, 'redeemed'), /余额不足/);
});

test('marks only unfinished overdue redemptions', () => {
  const now = new Date('2026-07-13T00:00:00.000Z');
  assert.equal(getDueAt(now).toISOString(), '2026-07-20T00:00:00.000Z');
  assert.equal(isOverdue({ status: 'pending', due_at: '2026-07-12T00:00:00.000Z' }, now), true);
  assert.equal(isOverdue({ status: 'ready', due_at: '2026-07-12T00:00:00.000Z' }, now), false);
  assert.equal(isOverdue({ status: 'fulfilled', due_at: '2026-07-12T00:00:00.000Z' }, now), false);
});
