const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const BASE_RULE = {
  code: 'care_confirmed',
  name: '养护记录审核通过',
  points: 10,
  description: '每条带照片的养护记录经管理员确认后发放',
};

const REWARD_RULES = [
  { code: 'growth_quality', name: '种植效果优秀', points: 50, description: '药材长势、叶色和整体状态表现优秀' },
  { code: 'stage_milestone', name: '关键生长节点', points: 30, description: '完成开花、结果或阶段性成长记录' },
  { code: 'excellent_harvest', name: '优秀收获成果', points: 100, description: '收获质量和过程档案完整' },
  { code: 'community_example', name: '社区示范家庭', points: 80, description: '养护持续、记录规范，具有示范作用' },
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

function calculateAccountUpdate(account, amount) {
  const balance = Number(account.balance || 0);
  const balanceAfter = balance + amount;
  if (balanceAfter < 0) throw new Error('账户余额不足，不能执行扣减');
  return {
    balance: balanceAfter,
    total_earned: Number(account.total_earned || 0) + (amount > 0 ? amount : 0),
    total_reversed: Number(account.total_reversed || 0) + (amount < 0 ? Math.abs(amount) : 0),
    transaction_count: Number(account.transaction_count || 0) + 1,
    version: Number(account.version || 0) + 1,
  };
}

async function getAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  return result.data[0] || null;
}

async function assertFamilyAccess(familyCode, openid) {
  if (await getAdmin(openid)) return;

  try {
    const member = await db.collection('family_members').doc(memberId(familyCode, openid)).get();
    if (member.data && member.data.family_code === familyCode) return;
  } catch (err) { /* fallback for accounts bound before family_members existed */ }

  const legacy = await db.collection('families').where({ family_code: familyCode, openid }).limit(1).get();
  if (!legacy.data.length) throw new Error('无权查看该家庭积分账户');
}

async function ensureAccount(familyCode) {
  const existing = await db.collection('points_accounts').where({ _id: familyCode }).limit(1).get();
  if (existing.data.length) return existing.data[0];

  const account = {
    family_code: familyCode,
    balance: 0,
    total_earned: 0,
    total_reversed: 0,
    transaction_count: 0,
    version: 0,
    created_at: db.serverDate(),
    updated_at: db.serverDate(),
  };
  await db.collection('points_accounts').doc(familyCode).set({ data: account });
  return account;
}

async function postTransaction({ familyCode, amount, type, sourceType, sourceId, ruleCode, description, operatorOpenid, requestKey }) {
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 500) {
    throw new Error('积分金额必须是 -500 至 500 之间的非零整数');
  }

  await ensureAccount(familyCode);
  const transactionId = `pt_${hashId(requestKey)}`;

  return db.runTransaction(async transaction => {
    try {
      const existing = await transaction.collection('points_transactions').doc(transactionId).get();
      if (existing.data) return { duplicate: true, transaction: existing.data };
    } catch (err) {
      if (!isDocumentNotFound(err)) throw err;
    }

    const accountRef = transaction.collection('points_accounts').doc(familyCode);
    const account = (await accountRef.get()).data;
    const accountUpdate = calculateAccountUpdate(account, amount);
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

  const [accountsResult, familiesResult, recentResult, backlogResult] = await Promise.all([
    db.collection('points_accounts').orderBy('balance', 'desc').limit(200).get(),
    db.collection('families').orderBy('family_code', 'asc').limit(200).get(),
    db.collection('points_transactions').orderBy('created_at', 'desc').limit(30).get(),
    db.collection('care_records').where({ audit_status: 'confirmed', points_status: db.command.neq('awarded') }).count(),
  ]);

  const accountMap = {};
  accountsResult.data.forEach(account => { accountMap[account.family_code] = account; });
  const accounts = familiesResult.data.map(family => ({
    family_code: family.family_code,
    community: family.community || '',
    balance: Number(accountMap[family.family_code] && accountMap[family.family_code].balance || 0),
    total_earned: Number(accountMap[family.family_code] && accountMap[family.family_code].total_earned || 0),
  }));

  return {
    accounts,
    recent: recentResult.data,
    summary: {
      account_count: accounts.length,
      total_balance: accounts.reduce((sum, item) => sum + item.balance, 0),
      total_issued: accounts.reduce((sum, item) => sum + item.total_earned, 0),
      backfill_pending: backlogResult.total,
    },
  };
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
    const posting = await postTransaction({
      familyCode: record.family_code,
      amount: BASE_RULE.points,
      type: 'care_award',
      sourceType: 'care_record',
      sourceId: record._id,
      ruleCode: BASE_RULE.code,
      description: `${record.herb_name || '药材'}历史养护记录补发`,
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
        return { success: true, data: { base: BASE_RULE, rewards: REWARD_RULES } };
      case 'getAdminOverview':
        return { success: true, data: await getAdminOverview(openid) };
      case 'grantReward':
        return { success: true, data: await grantReward(event, openid) };
      case 'backfillConfirmed':
        return { success: true, data: await backfillConfirmed(openid) };
      default:
        return { success: false, message: '未知积分银行操作' };
    }
  } catch (err) {
    console.error('积分银行操作失败:', err);
    return { success: false, message: err.message };
  }
};

exports._test = { hashId, calculateAccountUpdate, isDocumentNotFound, BASE_RULE, REWARD_RULES };
