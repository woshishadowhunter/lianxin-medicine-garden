const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function mockCloud(request, parent, isMain) {
  if (request === 'wx-server-sdk') {
    return {
      DYNAMIC_CURRENT_ENV: 'test',
      init() {},
      database() { return {}; },
      getWXContext() { return { OPENID: 'test-openid' }; },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const pointsBank = require('../cloudfunctions/pointsBank/index')._test;
const auditReview = require('../cloudfunctions/auditReview/index')._test;

const empty = { balance: 0, total_earned: 0, total_reversed: 0, transaction_count: 0, version: 0 };
const afterCare = pointsBank.calculateAccountUpdate(empty, 10);
assert.deepStrictEqual(afterCare, { balance: 10, total_earned: 10, total_reversed: 0, transaction_count: 1, version: 1 });

const afterReward = pointsBank.calculateAccountUpdate(afterCare, 50);
assert.strictEqual(afterReward.balance, 60);
assert.strictEqual(afterReward.total_earned, 60);

const afterReversal = pointsBank.calculateAccountUpdate(afterReward, -10);
assert.strictEqual(afterReversal.balance, 50);
assert.strictEqual(afterReversal.total_reversed, 10);
assert.throws(() => pointsBank.calculateAccountUpdate(empty, -10), /余额不足/);

assert.deepStrictEqual(auditReview.resolvePointsDelta('confirmed', 'none'), { amount: 10, pointsStatus: 'awarded' });
assert.deepStrictEqual(auditReview.resolvePointsDelta('confirmed', 'awarded'), { amount: 0, pointsStatus: 'awarded' });
assert.deepStrictEqual(auditReview.resolvePointsDelta('needs_revision', 'awarded'), { amount: -10, pointsStatus: 'reversed' });
assert.deepStrictEqual(auditReview.resolvePointsDelta('needs_revision', 'reversed'), { amount: 0, pointsStatus: 'reversed' });

assert.strictEqual(pointsBank.hashId('same-request'), pointsBank.hashId('same-request'));
assert.notStrictEqual(pointsBank.hashId('same-request'), pointsBank.hashId('other-request'));
assert.strictEqual(pointsBank.isDocumentNotFound(new Error('document not exist')), true);
assert.strictEqual(pointsBank.isDocumentNotFound(new Error('network timeout')), false);
assert.strictEqual(pointsBank.BASE_RULE.points, 10);
assert.deepStrictEqual(pointsBank.REWARD_RULES.map(item => item.points), [50, 30, 100, 80]);

console.log('Points bank invariants: OK');
