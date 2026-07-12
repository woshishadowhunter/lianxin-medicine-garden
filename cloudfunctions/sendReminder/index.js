const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

/**
 * 定时触发器：每天检查需要提醒的用户并发送订阅消息
 * 建议配置定时触发器：0 0 9 * * * *（每天早上9点执行）
 *
 * 手动调用参数：
 *   { action: 'remindInactive' }  — 提醒未养护用户
 *   { action: 'auditNotify', ids: [] } — 审核结果通知
 */
exports.main = async (event, context) => {
  const { action } = event;

  try {
    switch (action) {

      case 'remindInactive': {
        return await remindInactiveUsers();
      }

      case 'auditNotify': {
        return await notifyAuditResults(event.ids);
      }

      default: {
        return { success: false, message: '未知操作' };
      }
    }
  } catch (err) {
    console.error('发送提醒失败:', err);
    return { success: false, message: err.message };
  }
};

/**
 * 提醒超过3天未养护的家庭
 */
async function remindInactiveUsers() {
  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const dateStr = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth()+1).padStart(2,'0')}-${String(threeDaysAgo.getDate()).padStart(2,'0')}`;

  // 获取所有绑定过的家庭
  const familiesRes = await db.collection('families')
    .where({ openid: db.command.neq('') })
    .get();

  let sent = 0;
  let failed = 0;

  for (const family of familiesRes.data) {
    try {
      // 检查该家庭是否有近3天的养护记录
      const recentRes = await db.collection('care_records')
        .where({
          family_code: family.family_code,
          care_date: db.command.gte(dateStr),
        })
        .count();

      if (recentRes.total === 0) {
        // 发送提醒
        await cloud.openapi.subscribeMessage.send({
          touser: family.openid,
          templateId: 'YOUR_CARE_REMINDER_TEMPLATE_ID',
          data: {
            thing1: { value: family.family_code },
            thing2: { value: '超过3天未养护' },
            date3: { value: dateStr },
            thing4: { value: '请及时查看并养护您的植物' },
          },
          page: 'pages/submit/submit',
        });
        sent++;
      }
    } catch (err) {
      console.error(`提醒 ${family.family_code} 失败:`, err);
      failed++;
    }
  }

  return { success: true, sent, failed };
}

/**
 * 发送审核结果通知
 */
async function notifyAuditResults(ids) {
  if (!ids || !ids.length) {
    return { success: false, message: '未指定记录ID' };
  }

  const recordsRes = await db.collection('care_records')
    .where({ _id: db.command.in(ids) })
    .get();

  let sent = 0;
  let failed = 0;

  for (const record of recordsRes.data) {
    try {
      // 获取该家庭绑定的 openid
      const familyRes = await db.collection('families')
        .where({ family_code: record.family_code })
        .get();

      if (!familyRes.data.length || !familyRes.data[0].openid) continue;

      const statusText = record.audit_status === 'confirmed' ? '已确认通过' : '需要修正';
      const comment = record.audit_comment || (record.audit_status === 'confirmed' ? '审核通过' : '请查看审核意见');

      await cloud.openapi.subscribeMessage.send({
        touser: familyRes.data[0].openid,
        templateId: 'YOUR_AUDIT_RESULT_TEMPLATE_ID',
        data: {
          thing1: { value: record.plant_name || record.herb_name || '植物' },
          thing2: { value: statusText },
          thing5: { value: comment },
          date3: { value: record.care_date },
        },
        page: `/pages/record-detail/record-detail?id=${record._id}`,
      });
      sent++;
    } catch (err) {
      console.error(`通知审核结果失败:`, err);
      failed++;
    }
  }

  return { success: true, sent, failed };
}
