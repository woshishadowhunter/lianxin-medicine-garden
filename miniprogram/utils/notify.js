/**
 * 微信订阅消息管理
 *
 * 使用流程：
 *   1. 在微信公众平台配置订阅消息模板
 *   2. 将模板ID填入 TEMPLATE_IDS
 *   3. 用户点击订阅按钮，调用 requestSubscribe
 *   4. 云函数调用 openapi.subscribeMessage.send 发送消息
 */

/** 订阅消息模板ID — 需在微信公众平台申请后替换 */
const TEMPLATE_IDS = {
  careReminder: 'YOUR_CARE_REMINDER_TEMPLATE_ID',   // 养护提醒
  auditResult: 'YOUR_AUDIT_RESULT_TEMPLATE_ID',     // 审核结果通知
};

/**
 * 请求用户订阅消息授权
 * @param {string[]} types — 要订阅的消息类型 ['careReminder', 'auditResult']
 * @returns {Promise<boolean>} 用户是否授权
 */
function requestSubscribe(...types) {
  const tmplIds = types
    .map(t => TEMPLATE_IDS[t])
    .filter(Boolean);

  if (!tmplIds.length) {
    wx.showToast({ title: '消息模板未配置', icon: 'none' });
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        // 检查每个模板的授权状态
        const accepted = tmplIds.some(id => res[id] === 'accept');
        if (accepted) {
          // 记录订阅时间
          wx.setStorageSync('last_subscribe_time', Date.now());
        }
        resolve(accepted);
      },
      fail: (err) => {
        console.log('订阅消息授权失败:', err);
        resolve(false);
      },
    });
  });
}

/**
 * 获取距离上次订阅的天数
 * 用于判断是否需要再次提醒用户订阅（微信订阅消息有有效期）
 */
function getDaysSinceLastSubscribe() {
  const lastTime = wx.getStorageSync('last_subscribe_time');
  if (!lastTime) return Infinity;
  return Math.floor((Date.now() - lastTime) / 86400000);
}

/**
 * 建议用户重新订阅（超过30天时）
 */
function shouldResubscribe() {
  return getDaysSinceLastSubscribe() > 30;
}

module.exports = {
  TEMPLATE_IDS,
  requestSubscribe,
  shouldResubscribe,
};
