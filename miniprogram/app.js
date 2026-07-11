const { syncAll, getQueueCount } = require('./utils/offline');

App({
  onLaunch() {
    try {
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        return;
      }

      wx.cloud.init({
        env: 'your-cloud-env-id',
        traceUser: true,
      });

      this.loadUserRole();
      this.setupNetworkMonitor();
      this.autoSync();
    } catch (err) {
      console.error('App 初始化失败:', err);
    }
  },

  globalData: {
    userInfo: null,
    isAdmin: false,
    familyCode: '',
    openid: '',
    pendingSyncCount: 0,
  },

  loadUserRole() {
    const isAdmin = wx.getStorageSync('isAdmin');
    const familyCode = String(wx.getStorageSync('familyCode') || '').trim().toUpperCase();
    this.globalData.isAdmin = isAdmin === true;
    if (familyCode) {
      this.globalData.familyCode = familyCode;
      wx.setStorageSync('familyCode', familyCode);
    }
  },

  setupNetworkMonitor() {
    wx.onNetworkStatusChange((res) => {
      if (res.isConnected) {
        const count = getQueueCount();
        if (count > 0) {
          this.autoSync();
        }
      }
    });
  },

  async autoSync() {
    const count = getQueueCount();
    if (count === 0) return;

    const result = await syncAll();
    this.globalData.pendingSyncCount = result.total - result.synced - result.failed;

    if (result.synced > 0) {
      wx.showToast({
        title: `已同步 ${result.synced} 条记录`,
        icon: 'success',
      });
    }
  },
});
