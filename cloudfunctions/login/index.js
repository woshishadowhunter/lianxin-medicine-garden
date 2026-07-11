const crypto = require('crypto');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function memberId(familyCode, openid) {
  return `fm_${crypto.createHash('sha1').update(`${familyCode}:${openid}`).digest('hex')}`;
}

exports.main = async (event, context) => {
  const { action, familyCode, phone, password } = event;
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  switch (action) {

    case 'familyBind': {
      // 家庭用户绑定
      const res = await db.collection('families')
        .where({ family_code: familyCode, phone })
        .get();

      if (!res.data.length) {
        return { success: false, message: '家庭编号或手机号不正确' };
      }

      const family = res.data[0];
      // 更新绑定信息
      await db.collection('families').doc(family._id).update({
        data: {
          openid,
          member_count: db.command.inc(1),
          last_login: new Date(),
        },
      });

      await db.collection('family_members').doc(memberId(family.family_code, openid)).set({
        data: {
          family_code: family.family_code,
          openid,
          bound_at: db.serverDate(),
          last_login: db.serverDate(),
        },
      });

      return {
        success: true,
        data: {
          familyCode: family.family_code,
          community: family.community,
          herbs: family.herbs || [],
        },
      };
    }

    case 'adminLogin': {
      // 管理员登录
      const res = await db.collection('admins').where({ password }).limit(1).get();

      const admin = res.data[0];
      if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
        return { success: false, message: '密码错误' };
      }

      await db.collection('admins').doc(admin._id).update({
        data: { openid, last_login: db.serverDate() },
      });
      return { success: true, role: admin.role };
    }

    default:
      return { success: false, message: '未知操作' };
  }
};
