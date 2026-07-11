Page({
  data: {
    familyCode: '',
    phone: '',
    loading: false,
  },

  onFamilyCodeInput(e) { this.setData({ familyCode: e.detail.value }); },
  onPhoneInput(e) { this.setData({ phone: e.detail.value }); },

  doBind() {
    const familyCode = String(this.data.familyCode || '').trim().toUpperCase();
    const phone = String(this.data.phone || '').trim();
    if (!familyCode || !phone) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.cloud.callFunction({
      name: 'login',
      data: { action: 'familyBind', familyCode, phone },
      success: (res) => {
        this.setData({ loading: false });
        if (res.result.success) {
          const app = getApp();
          app.globalData.familyCode = familyCode;
          app.globalData.isAdmin = false;
          wx.setStorageSync('familyCode', familyCode);
          wx.setStorageSync('isAdmin', false);
          wx.showToast({ title: '绑定成功', icon: 'success' });
          setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 1000);
        } else {
          wx.showToast({ title: res.result.message || '验证失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
    });
  },
});
