const cloud = require('wx-server-sdk');
const { buildRecordDocument, hash } = require('./domain');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function memberId(familyCode, openid) {
  return `fm_${hash(`${familyCode}:${openid}`)}`;
}

function isDocumentNotFound(error) {
  const message = String(error && (error.message || error.errMsg) || '');
  return /document.*not.*exist|not.*found|不存在/i.test(message);
}

async function assertFamilyAccess(familyCode, openid) {
  const admin = await db.collection('admins').where({ openid }).limit(1).get();
  if (admin.data.length) return;

  try {
    const member = await db.collection('family_members').doc(memberId(familyCode, openid)).get();
    if (member.data && member.data.family_code === familyCode) return;
  } catch (error) {
    if (!isDocumentNotFound(error)) throw error;
  }

  const legacy = await db.collection('families')
    .where({ family_code: familyCode, openid })
    .limit(1)
    .get();
  if (!legacy.data.length) throw new Error('无权为该家庭提交养护记录');
}

exports.main = async (event = {}) => {
  const taskId = String(event.task_id || '').trim();

  try {
    if (!taskId) throw new Error('缺少种植任务');
    const taskResult = await db.collection('planting_tasks').doc(taskId).get();
    const task = taskResult.data;
    if (!task) throw new Error('种植任务不存在');

    const openid = cloud.getWXContext().OPENID;
    await assertFamilyAccess(task.family_code, openid);
    const record = buildRecordDocument(event, task);

    const result = await db.collection('care_records').add({
      data: {
        ...record,
        created_at: db.serverDate(),
        updated_at: db.serverDate(),
      },
    });

    await db.collection('planting_tasks').doc(taskId).update({
      data: {
        care_count: db.command.inc(1),
        last_care_date: record.care_date,
        last_care_type: record.care_type,
        updated_at: db.serverDate(),
      },
    });

    return { success: true, id: result._id };
  } catch (err) {
    console.error('提交记录失败:', err);
    return { success: false, message: err.message };
  }
};

exports._test = { assertFamilyAccess, isDocumentNotFound };
