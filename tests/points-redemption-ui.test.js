const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('family points page exposes redemption, cancellation, orders, and ledger actions', () => {
  const source = `${read('miniprogram/pages/points/points.js')}\n${read('miniprogram/pages/points/points.wxml')}`;
  ['getRedemptionCenter', 'redeemReward', 'cancelRedemption', '兑换好物', '我的兑换', '积分明细', '领取码'].forEach(value => {
    assert.match(source, new RegExp(value));
  });
});

test('admin points page exposes fulfillment queues and inventory actions', () => {
  const source = `${read('miniprogram/pages/admin/points/points.js')}\n${read('miniprogram/pages/admin/points/points.wxml')}`;
  ['getFulfillmentQueue', 'updateFulfillment', 'adjustRewardStock', 'queueRequestToken', 'pickupCode', '已超期', '待备货', '待领取', '礼品库存', '确认现场发放'].forEach(value => {
    assert.match(source, new RegExp(value));
  });
});

test('cloud redemption flow verifies pickup codes, reserved stock, and idempotent payloads', () => {
  const source = read('cloudfunctions/pointsBank/index.js');
  ['assertIdempotentMatch', 'assertReservedStock', 'getFulfillmentQueue', "submittedCode !== redemption.pickup_code", "['admin', 'super_admin']"].forEach(value => {
    assert.ok(source.includes(value), `missing ${value}`);
  });
});

test('all account initializers include redemption and refund totals', () => {
  [
    'cloudfunctions/pointsBank/index.js',
    'cloudfunctions/auditReview/index.js',
    'cloudfunctions/init-database/index.js',
    'scripts/init-database.js',
  ].forEach(file => {
    const source = read(file);
    assert.match(source, /total_redeemed:\s*0/);
    assert.match(source, /total_refunded:\s*0/);
  });
});
