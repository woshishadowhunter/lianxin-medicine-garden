const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const CARE_CONFIRM_POINTS = 10;

function hashId(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function isDocumentNotFound(error) {
  const message = String(error && (error.message || error.errMsg) || '');
  return /document.*not.*exist|not.*found|不存在/i.test(message);
}

function resolvePointsDelta(status, pointsStatus) {
  if (status === 'confirmed' && pointsStatus !== 'awarded') {
    return { amount: CARE_CONFIRM_POINTS, pointsStatus: 'awarded' };
  }
  if (status === 'needs_revision' && pointsStatus === 'awarded') {
    return { amount: -CARE_CONFIRM_POINTS, pointsStatus: 'reversed' };
  }
  return { amount: 0, pointsStatus };
}

async function assertAdmin(openid) {
  const result = await db.collection('admins').where({ openid }).limit(1).get();
  const admin = result.data[0];
  if (!admin || !['admin', 'super_admin'].includes(admin.role)) throw new Error('管理员身份已失效，请重新登录');
  return admin;
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

async function auditRecord(id, status, comment, adminOpenid) {
  const recordSnapshot = await db.collection('care_records').doc(id).get();
  const current = recordSnapshot.data;
  if (!current) throw new Error(`记录不存在: ${id}`);

  await ensureAccount(current.family_code);

  return db.runTransaction(async transaction => {
    const recordRef = transaction.collection('care_records').doc(id);
    const record = (await recordRef.get()).data;
    const accountRef = transaction.collection('points_accounts').doc(record.family_code);
    const account = (await accountRef.get()).data;

    const pointsChange = resolvePointsDelta(status, record.points_status || 'none');
    const { amount } = pointsChange;
    const pointsStatus = pointsChange.pointsStatus;

    const sequence = Number(record.points_sequence || 0) + (amount ? 1 : 0);
    const recordUpdate = {
      audit_status: status,
      audit_comment: comment,
      audited_by: adminOpenid,
      audited_at: db.serverDate(),
      updated_at: db.serverDate(),
      points_status: pointsStatus,
      points_sequence: sequence,
    };

    if (amount) {
      const balanceAfter = Number(account.balance || 0) + amount;
      const transactionId = `pt_${hashId(`care:${id}:${sequence}:${status}`)}`;
      const plantName = record.plant_name || record.herb_name || '植物';

      await transaction.collection('points_transactions').doc(transactionId).set({
        data: {
          transaction_no: transactionId,
          family_code: record.family_code,
          amount,
          balance_after: balanceAfter,
          type: amount > 0 ? 'care_award' : 'reversal',
          source_type: 'care_record',
          source_id: id,
          rule_code: 'care_confirmed',
          description: amount > 0 ? `${plantName}养护记录审核通过` : `${plantName}养护积分冲正`,
          operator_openid: adminOpenid,
          created_at: db.serverDate(),
        },
      });

      await accountRef.update({
        data: {
          balance: balanceAfter,
          total_earned: Number(account.total_earned || 0) + (amount > 0 ? amount : 0),
          total_reversed: Number(account.total_reversed || 0) + (amount < 0 ? Math.abs(amount) : 0),
          transaction_count: Number(account.transaction_count || 0) + 1,
          version: Number(account.version || 0) + 1,
          updated_at: db.serverDate(),
        },
      });
    }

    await recordRef.update({ data: recordUpdate });
    return { id, points: amount };
  });
}

exports.main = async (event) => {
  const { ids, status, comment = '' } = event;

  try {
    if (!Array.isArray(ids) || !ids.length) throw new Error('请选择审核记录');
    if (!['confirmed', 'needs_revision'].includes(status)) throw new Error('无效审核状态');

    const adminOpenid = cloud.getWXContext().OPENID;
    await assertAdmin(adminOpenid);

    const results = [];
    for (const id of ids) {
      results.push(await auditRecord(id, status, comment, adminOpenid));
    }

    await db.collection('admin_logs').add({
      data: {
        action: 'audit',
        record_ids: ids,
        new_status: status,
        comment,
        points_delta: results.reduce((sum, item) => sum + item.points, 0),
        admin_openid: adminOpenid,
        operated_at: db.serverDate(),
      },
    });

    return {
      success: true,
      count: results.length,
      pointsIssued: results.filter(item => item.points > 0).reduce((sum, item) => sum + item.points, 0),
      pointsReversed: Math.abs(results.filter(item => item.points < 0).reduce((sum, item) => sum + item.points, 0)),
    };
  } catch (err) {
    console.error('审核失败:', err);
    return { success: false, message: err.message };
  }
};

exports._test = { resolvePointsDelta, CARE_CONFIRM_POINTS };
