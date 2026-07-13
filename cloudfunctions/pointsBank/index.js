const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const {
  REDEMPTION_CATALOG,
  getCatalogItem,
  validateRedemptionInput,
  calculateRedemption,
  assertStatusTransition,
  assertIdempotentMatch,
  assertReservedStock,
  calculateAccountUpdate,
  getDueAt,
  isOverdue,
} = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const BASE_RULE = {
  code: 'care_confirmed',
  name: '养护记录审核通过',
  points: 10,
  description: '每条带照片的养护记录经管理员确认后发放',
};

const REWARD_RULES = [
  { code: 'growth_quality', name: '成长状态优秀', points: 50, description: '植物长势、叶色和整体状态表现优秀' },
  { code: 'stage_milestone', name: '关键生长节点', points: 30, description: '完成开花、结果或阶段性成长记录' },
  { code: 'excellent_harvest', name: '完整成长档案', points: 100, description: '照片连续、观察完整并记录关键变化' },
  { code: 'community_example', name: '社区绿色示范', points: 80, description: '养护持续、记录规范，具有示范作用' },
];

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function memberId(familyCode, openid) {
  return `fm_${hashId(`${familyCode}:${openid}`)}`;
}

function isDocumentNotFound(error) {
  const message = String(error && (error.message || error.errMsg) || '');
  return /document.*not.*exist|not.*found|不存在/i.test(message);
}

async function getAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  const admin = result.data[0] || null;
  return admin && ['admin', 'super_admin'].includes(admin.role) ? admin : null;
}

async function assertFamilyAccess(familyCode, openid, allowAdmin = true) {
  if (allowAdmin && await getAdmin(openid)) return;

  try {
    const member = await db.collection('family_members').doc(memberId(familyCode, openid)).get();
    if (member.data && member.data.family_code === familyCode) return;
  } catch (err) { /* fallback for accounts bound before family_members existed */ }

  const legacy = await db.collection('families').where({ family_code: familyCode, openid }).limit(1).get();
  if (!legacy.data.length) throw new Error('无权查看该家庭积分账户');
}

async function ensureAccount(familyCode) {
  try {
    const existing = await db.collection('points_accounts').doc(familyCode).get();
    if (existing.data) return existing.data;
  } catch (err) {
    if (!isDocumentNotFound(err)) throw err;
  }
  const history = await db.collection('points_transactions').where({ family_code: familyCode }).limit(1).get();
  if (history.data.length) throw new Error(`家庭 ${familyCode} 积分账户缺失，请先修复台账`);

  return db.runTransaction(async transaction => {
    const accountRef = transaction.collection('points_accounts').doc(familyCode);
    try {
      const existing = await accountRef.get();
      if (existing.data) return existing.data;
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }

    const now = new Date();
    const account = {
      family_code: familyCode,
      balance: 0,
      total_earned: 0,
      total_reversed: 0,
      total_redeemed: 0,
      total_refunded: 0,
      transaction_count: 0,
      version: 0,
      created_at: now,
      updated_at: now,
    };
    await accountRef.set({ data: account });
    return account;
  });
}

async function postTransaction({ familyCode, amount, type, sourceType, sourceId, ruleCode, description, operatorOpenid, requestKey, metric }) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    throw new Error('积分金额必须是 -500 至 500 之间的非零整数');
  }

  await ensureAccount(familyCode);
  const transactionId = `pt_${hashId(requestKey)}`;

  return db.runTransaction(async transaction => {
    try {
      const existing = await transaction.collection('points_transactions').doc(transactionId).get();
      if (existing.data) {
        assertIdempotentMatch(existing.data, {
          family_code: familyCode, amount, type, source_type: sourceType, source_id: sourceId || '', rule_code: ruleCode || '',
        }, ['family_code', 'amount', 'type', 'source_type', 'source_id', 'rule_code']);
        return { duplicate: true, transaction: existing.data };
      }
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }

    const accountRef = transaction.collection('points_accounts').doc(familyCode);
    const account = (await accountRef.get()).data;
    const accountUpdate = calculateAccountUpdate(account, amount, metric || (amount > 0 ? 'earned' : 'reversed'));
    const balanceAfter = accountUpdate.balance;

    const transactionData = {
      transaction_no: transactionId,
      family_code: familyCode,
      amount,
      balance_after: balanceAfter,
      type,
      source_type: sourceType,
      source_id: sourceId || '',
      rule_code: ruleCode || '',
      description,
      operator_openid: operatorOpenid || '',
      created_at: db.serverDate(),
    };

    await transaction.collection('points_transactions').doc(transactionId).set({ data: transactionData });
    await accountRef.update({
      data: {
        ...accountUpdate,
        updated_at: db.serverDate(),
      },
    });

    return { duplicate: false, transaction: transactionData };
  });
}

function pickupCode(redemptionId) {
  return String(parseInt(hashId(redemptionId).slice(0, 8), 16) % 10000).padStart(4, '0');
}

async function ensureRewardStock() {
  for (const item of REDEMPTION_CATALOG) {
    try {
      const existing = await db.collection('points_reward_stock').doc(item.code).get();
      if (existing.data) continue;
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }
    const [logHistory, redemptionHistory] = await Promise.all([
      db.collection('points_redemption_logs').where({ reward_code: item.code }).limit(1).get(),
      db.collection('points_redemptions').where({ reward_code: item.code }).limit(1).get(),
    ]);
    if (logHistory.data.length || redemptionHistory.data.length) throw new Error(`${item.name}库存台账缺失，请先修复后再操作`);

    await db.runTransaction(async transaction => {
      const stockRef = transaction.collection('points_reward_stock').doc(item.code);
      try {
        const existing = await stockRef.get();
        if (existing.data) return;
      } catch (err) {
        if (!isDocumentNotFound(err)) throw err;
      }

      const now = new Date();
      await stockRef.set({ data: {
        reward_code: item.code,
        available: item.stock,
        reserved: 0,
        fulfilled: 0,
        total_received: item.stock,
        version: 0,
        created_at: now,
        updated_at: now,
      } });
      const logId = `pl_${hashId(`stock-init:${item.code}:${now.getTime()}`)}`;
      await transaction.collection('points_redemption_logs').doc(logId).set({
        data: { redemption_no: '', reward_code: item.code, action: 'stock_initialization', delta: item.stock, available_after: item.stock, operator_openid: '', note: '系统初始化兑换库存', created_at: now },
      });
    });
  }
}

function mapCatalog(stockRows) {
  const stockMap = {};
  stockRows.forEach(item => { stockMap[item.reward_code || item._id] = item; });
  return REDEMPTION_CATALOG.map(item => ({
    ...item,
    available: Number(stockMap[item.code] && stockMap[item.code].available || 0),
    reserved: Number(stockMap[item.code] && stockMap[item.code].reserved || 0),
    fulfilled: Number(stockMap[item.code] && stockMap[item.code].fulfilled || 0),
  }));
}

async function getRedemptionCenter(familyCode, openid) {
  await assertFamilyAccess(familyCode, openid);
  await ensureRewardStock();
  const [account, stockResult, redemptionsResult] = await Promise.all([
    ensureAccount(familyCode),
    db.collection('points_reward_stock').limit(20).get(),
    db.collection('points_redemptions').where({ family_code: familyCode }).orderBy('created_at', 'desc').limit(30).get(),
  ]);
  return {
    account,
    catalog: mapCatalog(stockResult.data),
    redemptions: redemptionsResult.data,
  };
}

async function redeemReward(event, openid) {
  const input = validateRedemptionInput(event);
  await assertFamilyAccess(input.familyCode, openid, false);
  await ensureAccount(input.familyCode);
  await ensureRewardStock();

  const reward = getCatalogItem(input.rewardCode);
  const redemptionId = `rd_${hashId(`${input.familyCode}:${input.requestId}`)}`;
  const transactionId = `pt_${hashId(`redemption:${redemptionId}`)}`;
  const logId = `pl_${hashId(`created:${redemptionId}`)}`;

  return db.runTransaction(async transaction => {
    try {
      const existing = await transaction.collection('points_redemptions').doc(redemptionId).get();
      if (existing.data) {
        assertIdempotentMatch(existing.data, {
          family_code: input.familyCode,
          reward_code: reward.code,
          quantity: input.quantity,
          points_cost: reward.points * input.quantity,
        }, ['family_code', 'reward_code', 'quantity', 'points_cost']);
        return { duplicate: true, redemption: existing.data };
      }
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }

    const accountRef = transaction.collection('points_accounts').doc(input.familyCode);
    const stockRef = transaction.collection('points_reward_stock').doc(reward.code);
    const [accountResult, stockResult] = await Promise.all([accountRef.get(), stockRef.get()]);
    const account = accountResult.data;
    const stock = stockResult.data;
    const totals = calculateRedemption(account.balance, stock.available, reward, input.quantity);
    const accountUpdate = calculateAccountUpdate(account, -totals.pointsCost, 'redeemed');
    const now = new Date();
    const redemption = {
      redemption_no: redemptionId,
      family_code: input.familyCode,
      reward_code: reward.code,
      reward_name: reward.name,
      quantity: input.quantity,
      points_cost: totals.pointsCost,
      status: 'pending',
      pickup_code: pickupCode(redemptionId),
      due_at: getDueAt(now),
      note: String(event.note || '').trim().slice(0, 120),
      requester_openid: openid,
      created_at: now,
      updated_at: now,
    };

    await accountRef.update({ data: { ...accountUpdate, updated_at: now } });
    await stockRef.update({
      data: {
        available: Number(stock.available || 0) - input.quantity,
        reserved: Number(stock.reserved || 0) + input.quantity,
        version: Number(stock.version || 0) + 1,
        updated_at: now,
      },
    });
    await transaction.collection('points_transactions').doc(transactionId).set({
      data: {
        transaction_no: transactionId,
        family_code: input.familyCode,
        amount: -totals.pointsCost,
        balance_after: accountUpdate.balance,
        type: 'redemption',
        source_type: 'points_redemption',
        source_id: redemptionId,
        rule_code: reward.code,
        description: `兑换${reward.name}`,
        operator_openid: openid,
        created_at: now,
      },
    });
    await transaction.collection('points_redemptions').doc(redemptionId).set({ data: redemption });
    await transaction.collection('points_redemption_logs').doc(logId).set({
      data: { redemption_no: redemptionId, from_status: '', to_status: 'pending', operator_openid: openid, note: '家庭提交兑换', created_at: now },
    });
    return { duplicate: false, redemption };
  });
}

async function cancelRedemption(event, openid, asAdmin = false) {
  const redemptionId = String(event.redemptionId || '').trim();
  if (!/^rd_[a-f0-9]{40}$/.test(redemptionId)) throw new Error('兑换编号格式不正确');
  const snapshot = await db.collection('points_redemptions').doc(redemptionId).get();
  if (!snapshot.data) throw new Error('兑换记录不存在');
  const initial = snapshot.data;
  if (asAdmin) {
    if (!await getAdmin(openid)) throw new Error('管理员身份已失效，请重新登录');
  } else {
    await assertFamilyAccess(initial.family_code, openid, false);
    if (!['pending', 'canceled'].includes(initial.status)) throw new Error('仅待备货的兑换可以由家庭取消');
  }

  const refundId = `pt_${hashId(`refund:${redemptionId}`)}`;
  const logId = `pl_${hashId(`canceled:${redemptionId}`)}`;
  return db.runTransaction(async transaction => {
    const redemptionRef = transaction.collection('points_redemptions').doc(redemptionId);
    const redemption = (await redemptionRef.get()).data;
    if (redemption.status === 'canceled') return { duplicate: true, redemption };
    assertStatusTransition(redemption.status, 'canceled');

    const accountRef = transaction.collection('points_accounts').doc(redemption.family_code);
    const stockRef = transaction.collection('points_reward_stock').doc(redemption.reward_code);
    const [accountResult, stockResult] = await Promise.all([accountRef.get(), stockRef.get()]);
    const accountUpdate = calculateAccountUpdate(accountResult.data, redemption.points_cost, 'refunded');
    const stock = stockResult.data;
    assertReservedStock(stock, redemption.quantity);
    const now = new Date();

    await accountRef.update({ data: { ...accountUpdate, updated_at: now } });
    await stockRef.update({
      data: {
        available: Number(stock.available || 0) + redemption.quantity,
        reserved: Number(stock.reserved || 0) - redemption.quantity,
        version: Number(stock.version || 0) + 1,
        updated_at: now,
      },
    });
    await transaction.collection('points_transactions').doc(refundId).set({
      data: {
        transaction_no: refundId,
        family_code: redemption.family_code,
        amount: redemption.points_cost,
        balance_after: accountUpdate.balance,
        type: 'redemption_refund',
        source_type: 'points_redemption',
        source_id: redemptionId,
        rule_code: redemption.reward_code,
        description: `${redemption.reward_name}兑换取消退款`,
        operator_openid: openid,
        created_at: now,
      },
    });
    await redemptionRef.update({ data: { status: 'canceled', canceled_at: now, canceled_by: openid, updated_at: now } });
    await transaction.collection('points_redemption_logs').doc(logId).set({
      data: { redemption_no: redemptionId, from_status: redemption.status, to_status: 'canceled', operator_openid: openid, note: String(event.note || '').trim().slice(0, 120), created_at: now },
    });
    return { duplicate: false, redemption: { ...redemption, status: 'canceled' } };
  });
}

async function updateFulfillment(event, openid) {
  if (!await getAdmin(openid)) throw new Error('管理员身份已失效，请重新登录');
  const redemptionId = String(event.redemptionId || '').trim();
  const nextStatus = String(event.status || '').trim();
  if (!/^rd_[a-f0-9]{40}$/.test(redemptionId)) throw new Error('兑换编号格式不正确');
  if (nextStatus === 'canceled') return cancelRedemption(event, openid, true);
  if (!['ready', 'fulfilled'].includes(nextStatus)) throw new Error('未知发放状态');

  const logId = `pl_${hashId(`${nextStatus}:${redemptionId}`)}`;
  return db.runTransaction(async transaction => {
    const redemptionRef = transaction.collection('points_redemptions').doc(redemptionId);
    const redemption = (await redemptionRef.get()).data;
    if (redemption.status === nextStatus) return { duplicate: true, redemption };
    assertStatusTransition(redemption.status, nextStatus);
    const now = new Date();

    if (nextStatus === 'fulfilled') {
      const submittedCode = String(event.pickupCode || '').trim();
      if (!/^\d{4}$/.test(submittedCode) || submittedCode !== redemption.pickup_code) throw new Error('领取码不正确，请与家庭核对');
      const stockRef = transaction.collection('points_reward_stock').doc(redemption.reward_code);
      const stock = (await stockRef.get()).data;
      assertReservedStock(stock, redemption.quantity);
      await stockRef.update({
        data: {
          reserved: Number(stock.reserved || 0) - redemption.quantity,
          fulfilled: Number(stock.fulfilled || 0) + redemption.quantity,
          version: Number(stock.version || 0) + 1,
          updated_at: now,
        },
      });
    }

    const timeField = nextStatus === 'ready' ? { ready_at: now } : { fulfilled_at: now };
    await redemptionRef.update({ data: { status: nextStatus, ...timeField, operator_openid: openid, updated_at: now } });
    await transaction.collection('points_redemption_logs').doc(logId).set({
      data: { redemption_no: redemptionId, from_status: redemption.status, to_status: nextStatus, operator_openid: openid, note: String(event.note || '').trim().slice(0, 120), created_at: now },
    });
    return { duplicate: false, redemption: { ...redemption, status: nextStatus } };
  });
}

async function adjustRewardStock(event, openid) {
  if (!await getAdmin(openid)) throw new Error('管理员身份已失效，请重新登录');
  const reward = getCatalogItem(String(event.rewardCode || ''));
  const delta = Number(event.delta);
  const requestId = String(event.requestId || '').trim();
  if (!reward) throw new Error('兑换项目不存在');
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 500) throw new Error('库存调整必须是 -500 至 500 的非零整数');
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) throw new Error('库存调整请求编号格式不正确');
  await ensureRewardStock();

  return db.runTransaction(async transaction => {
    const stockRef = transaction.collection('points_reward_stock').doc(reward.code);
    const logId = `pl_${hashId(`stock:${reward.code}:${requestId}`)}`;
    try {
      const existing = await transaction.collection('points_redemption_logs').doc(logId).get();
      if (existing.data) return { duplicate: true, rewardCode: reward.code, available: existing.data.available_after };
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }
    const stock = (await stockRef.get()).data;
    const available = Number(stock.available || 0) + delta;
    if (available < 0) throw new Error('可用库存不能小于零');
    const now = new Date();
    await stockRef.update({ data: {
      available,
      total_received: Number(stock.total_received || 0) + Math.max(delta, 0),
      version: Number(stock.version || 0) + 1,
      updated_at: now,
    } });
    await transaction.collection('points_redemption_logs').doc(logId).set({
      data: { redemption_no: '', reward_code: reward.code, action: 'stock_adjustment', delta, available_after: available, operator_openid: openid, note: String(event.note || '').trim().slice(0, 120), created_at: now },
    });
    return { duplicate: false, rewardCode: reward.code, available };
  });
}

async function getAccount(familyCode, openid) {
  await assertFamilyAccess(familyCode, openid);
  return ensureAccount(familyCode);
}

async function getTransactions(familyCode, openid, page = 1, pageSize = 20) {
  await assertFamilyAccess(familyCode, openid);
  const safeSize = Math.min(Math.max(Number(pageSize) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const result = await db.collection('points_transactions')
    .where({ family_code: familyCode })
    .orderBy('created_at', 'desc')
    .skip((safePage - 1) * safeSize)
    .limit(safeSize)
    .get();
  return result.data;
}

async function getAdminOverview(openid) {
  const admin = await getAdmin(openid);
  if (!admin) throw new Error('管理员身份已失效，请重新登录');
  await ensureRewardStock();

  const now = new Date();
  const [accountsResult, familiesResult, recentResult, backlogResult, stockResult, overdueCountResult, pendingCountResult, readyCountResult] = await Promise.all([
    db.collection('points_accounts').orderBy('balance', 'desc').limit(200).get(),
    db.collection('families').orderBy('family_code', 'asc').limit(200).get(),
    db.collection('points_transactions').orderBy('created_at', 'desc').limit(30).get(),
    db.collection('care_records').where({ audit_status: 'confirmed', points_status: db.command.neq('awarded') }).count(),
    db.collection('points_reward_stock').limit(20).get(),
    db.collection('points_redemptions').where({ status: 'pending', due_at: db.command.lt(now) }).count(),
    db.collection('points_redemptions').where({ status: 'pending' }).count(),
    db.collection('points_redemptions').where({ status: 'ready' }).count(),
  ]);

  const accountMap = {};
  accountsResult.data.forEach(account => { accountMap[account.family_code] = account; });
  const accounts = familiesResult.data.map(family => ({
    family_code: family.family_code,
    community: family.community || '',
    balance: Number(accountMap[family.family_code] && accountMap[family.family_code].balance || 0),
    total_earned: Number(accountMap[family.family_code] && accountMap[family.family_code].total_earned || 0),
    total_redeemed: Number(accountMap[family.family_code] && accountMap[family.family_code].total_redeemed || 0),
  }));

  return {
    accounts,
    recent: recentResult.data,
    catalog: mapCatalog(stockResult.data),
    summary: {
      account_count: accounts.length,
      total_balance: accounts.reduce((sum, item) => sum + item.balance, 0),
      total_issued: accounts.reduce((sum, item) => sum + item.total_earned, 0),
      total_redeemed: accounts.reduce((sum, item) => sum + item.total_redeemed, 0),
      backfill_pending: backlogResult.total,
      fulfillment_pending: pendingCountResult.total,
      fulfillment_ready: readyCountResult.total,
      fulfillment_overdue: overdueCountResult.total,
    },
  };
}

async function getFulfillmentQueue(event, openid) {
  if (!await getAdmin(openid)) throw new Error('管理员身份已失效，请重新登录');
  const status = String(event.status || 'pending');
  const allowed = ['overdue', 'pending', 'ready', 'fulfilled', 'canceled'];
  if (!allowed.includes(status)) throw new Error('未知发放队列');
  const page = Math.max(Number(event.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(event.pageSize) || 30, 1), 50);
  const collection = db.collection('points_redemptions');
  const now = new Date();
  let query;
  if (status === 'overdue') {
    query = collection.where({ status: 'pending', due_at: db.command.lt(now) }).orderBy('due_at', 'asc');
  } else {
    query = collection.where({ status }).orderBy('created_at', 'desc');
  }
  const result = await query.skip((page - 1) * pageSize).limit(pageSize).get();
  return result.data.map(item => ({ ...item, overdue: isOverdue(item, now) }));
}

async function backfillConfirmed(openid) {
  const admin = await getAdmin(openid);
  if (!admin) throw new Error('管理员身份已失效，请重新登录');

  const result = await db.collection('care_records')
    .where({ audit_status: 'confirmed', points_status: db.command.neq('awarded') })
    .orderBy('created_at', 'asc')
    .limit(20)
    .get();

  let issued = 0;
  for (const record of result.data) {
    const plantName = record.plant_name || record.herb_name || '植物';
    const posting = await postTransaction({
      familyCode: record.family_code,
      amount: BASE_RULE.points,
      type: 'care_award',
      sourceType: 'care_record',
      sourceId: record._id,
      ruleCode: BASE_RULE.code,
      description: `${plantName}历史养护记录补发`,
      operatorOpenid: openid,
      requestKey: `care-backfill:${record._id}`,
    });
    if (!posting.duplicate) issued += BASE_RULE.points;
    await db.collection('care_records').doc(record._id).update({
      data: {
        points_status: 'awarded',
        points_sequence: Math.max(Number(record.points_sequence || 0), 1),
        updated_at: db.serverDate(),
      },
    });
  }

  return { processed: result.data.length, pointsIssued: issued };
}

async function grantReward(event, openid) {
  const admin = await getAdmin(openid);
  if (!admin) throw new Error('管理员身份已失效，请重新登录');

  const { familyCode, rewardType, note = '', requestId } = event;
  if (!familyCode || !requestId) throw new Error('缺少家庭编号或请求编号');
  const rule = REWARD_RULES.find(item => item.code === rewardType);
  if (!rule) throw new Error('未知奖励类型');

  const family = await db.collection('families').where({ family_code: familyCode }).limit(1).get();
  if (!family.data.length) throw new Error('家庭编号不存在');

  return postTransaction({
    familyCode,
    amount: rule.points,
    type: 'reward',
    sourceType: 'admin_reward',
    sourceId: requestId,
    ruleCode: rule.code,
    description: note ? `${rule.name}：${note}` : rule.name,
    operatorOpenid: openid,
    requestKey: `reward:${openid}:${requestId}`,
  });
}

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID;

  try {
    switch (event.action) {
      case 'getAccount':
        return { success: true, data: await getAccount(event.familyCode, openid) };
      case 'getTransactions':
        return { success: true, data: await getTransactions(event.familyCode, openid, event.page, event.pageSize) };
      case 'getRules':
        return { success: true, data: { base: BASE_RULE, rewards: REWARD_RULES, redemptionCatalog: REDEMPTION_CATALOG } };
      case 'getRedemptionCenter':
        return { success: true, data: await getRedemptionCenter(event.familyCode, openid) };
      case 'redeemReward':
        return { success: true, data: await redeemReward(event, openid) };
      case 'cancelRedemption':
        return { success: true, data: await cancelRedemption(event, openid) };
      case 'getAdminOverview':
        return { success: true, data: await getAdminOverview(openid) };
      case 'getFulfillmentQueue':
        return { success: true, data: await getFulfillmentQueue(event, openid) };
      case 'grantReward':
        return { success: true, data: await grantReward(event, openid) };
      case 'backfillConfirmed':
        return { success: true, data: await backfillConfirmed(openid) };
      case 'updateFulfillment':
        return { success: true, data: await updateFulfillment(event, openid) };
      case 'adjustRewardStock':
        return { success: true, data: await adjustRewardStock(event, openid) };
      default:
        return { success: false, message: '未知积分银行操作' };
    }
  } catch (err) {
    console.error('积分银行操作失败:', err);
    return { success: false, message: err.message };
  }
};

exports._test = { hashId, calculateAccountUpdate, isDocumentNotFound, BASE_RULE, REWARD_RULES, REDEMPTION_CATALOG };
