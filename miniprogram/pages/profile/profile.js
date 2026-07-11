const { getQueueCount, getSyncStatus } = require('../../utils/offline');
const { requestSubscribe, shouldResubscribe } = require('../../utils/notify');

Page({
  data: {
    isBound: false,
    familyCode: '',
    community: '',
    isAdmin: false,
    pendingSync: 0,
    syncStatus: 'idle',
    pointsBalance: 0,
  },

  onShow() {
    const app = getApp();
    this.setData({
      isBound: !!app.globalData.familyCode,
      familyCode: app.globalData.familyCode,
      isAdmin: app.globalData.isAdmin,
      pendingSync: getQueueCount(),
      syncStatus: getSyncStatus(),
    });

    if (app.globalData.familyCode) {
      this.loadFamilyInfo();
    }
  },

  async loadFamilyInfo() {
    try {
      const app = getApp();
      const db = wx.cloud.database();
      const [res, pointsRes] = await Promise.all([
        db.collection('families').where({ family_code: app.globalData.familyCode }).get(),
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getAccount', familyCode: app.globalData.familyCode } }),
      ]);
      if (res.data.length) {
        this.setData({
          community: res.data[0].community,
          pointsBalance: pointsRes.result && pointsRes.result.success ? pointsRes.result.data.balance : 0,
        });
      }
    } catch (err) { /* ignore */ }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/bind' });
  },

  goGrowthArchive() {
    wx.navigateTo({ url: '/pages/growth-archive/growth-archive' });
  },

  goAnnualShowcase() {
    wx.navigateTo({ url: '/pages/annual-showcase/annual-showcase' });
  },

  goPoints() {
    wx.navigateTo({ url: '/pages/points/points' });
  },

  subscribeReminder() {
    wx.showModal({
      title: '订阅养护提醒',
      content: '订阅后，当您的药材超过3天未养护时，我们将通过微信服务通知提醒您。同时您也会收到审核结果通知。',
      confirmText: '去订阅',
      success: async (res) => {
        if (res.confirm) {
          const accepted = await requestSubscribe('careReminder', 'auditResult');
          if (accepted) {
            wx.showToast({ title: '订阅成功', icon: 'success' });
          }
        }
      },
    });
  },

  syncNow() {
    const app = getApp();
    app.autoSync().then(() => {
      this.setData({
        pendingSync: getQueueCount(),
        syncStatus: getSyncStatus(),
      });
    });
  },

  switchToAdmin() {
    wx.showModal({
      title: '管理员登录',
      content: '请输入管理员密码',
      editable: true,
      success: (res) => {
        if (res.confirm) {
          wx.cloud.callFunction({
            name: 'login',
            data: { action: 'adminLogin', password: res.content },
            success: (result) => {
              if (result.result.success) {
                getApp().globalData.isAdmin = true;
                wx.setStorageSync('isAdmin', true);
                this.setData({ isAdmin: true });
                wx.showToast({ title: '已切换为管理员', icon: 'success' });
              } else {
                wx.showToast({ title: '密码错误', icon: 'none' });
              }
            },
          });
        }
      },
    });
  },

  goAdminDashboard() {
    wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
  },

  goAdminAudit() {
    wx.navigateTo({ url: '/pages/admin/audit/audit' });
  },

  goAdminPoints() {
    wx.navigateTo({ url: '/pages/admin/points/points' });
  },

  showHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '家庭用户可在“养护”页提交带照片的记录；记录提交后由管理员审核。离线时记录会暂存本地，网络恢复后自动同步。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于连心药园',
      content: '连心药园用于记录社区家庭中草药种植养护过程，沉淀照片证据、审核记录和年度种植成效。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  // 绑定表单
  bindFamilyCode: '',
  bindPhone: '',

  onFamilyCodeInput(e) { this.bindFamilyCode = e.detail.value; },
  onPhoneInput(e) { this.bindPhone = e.detail.value; },

  doBind() {
    const familyCode = String(this.bindFamilyCode || '').trim().toUpperCase();
    const phone = String(this.bindPhone || '').trim();
    if (!familyCode || !phone) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    wx.cloud.callFunction({
      name: 'login',
      data: { action: 'familyBind', familyCode, phone },
      success: (res) => {
        if (res.result.success) {
          const app = getApp();
          app.globalData.familyCode = familyCode;
          app.globalData.isAdmin = false;
          wx.setStorageSync('familyCode', familyCode);
          wx.setStorageSync('isAdmin', false);
          wx.showToast({ title: '绑定成功', icon: 'success' });
          setTimeout(() => {
            this.setData({ isBound: true, familyCode, isAdmin: false });
            wx.switchTab({ url: '/pages/index/index' });
          }, 1000);
        } else {
          wx.showToast({ title: res.result.message || '绑定失败', icon: 'none' });
        }
      },
    });
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          const app = getApp();
          app.globalData.familyCode = '';
          app.globalData.isAdmin = false;
          wx.removeStorageSync('familyCode');
          wx.removeStorageSync('isAdmin');
          this.setData({ isBound: false, familyCode: '', community: '', isAdmin: false });
          wx.switchTab({ url: '/pages/index/index' });
        }
      },
    });
  },
});
