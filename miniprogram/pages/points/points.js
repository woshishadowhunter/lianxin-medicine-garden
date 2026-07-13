Page({
  data: {
    familyCode: '',
    loading: true,
    actionLoading: '',
    activeView: 'rewards',
    account: { balance: 0, total_earned: 0, total_redeemed: 0, transaction_count: 0 },
    catalog: [],
    redemptions: [],
    transactions: [],
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this.setData({ familyCode: getApp().globalData.familyCode || wx.getStorageSync('familyCode') || '' });
  },

  onShow() { this.refresh(); },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.activeView === 'ledger' && this.data.hasMore && !this.data.loading) this.loadTransactions();
  },

  switchView(e) {
    this.setData({ activeView: e.currentTarget.dataset.view });
  },

  async refresh() {
    if (!this.data.familyCode) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, page: 1, transactions: [], hasMore: true });

    try {
      const centerRes = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'getRedemptionCenter', familyCode: this.data.familyCode },
      });
      if (!centerRes.result.success) throw new Error(centerRes.result.message);
      const center = centerRes.result.data;
      const balance = Number(center.account.balance || 0);
      this.setData({
        account: center.account,
        catalog: center.catalog.map(item => ({
          ...item,
          canRedeem: item.available > 0 && balance >= item.points,
          shortage: Math.max(item.points - balance, 0),
        })),
        redemptions: center.redemptions.map(item => this.mapRedemption(item)),
      });
      await this.loadTransactions();
    } catch (err) {
      wx.showToast({ title: err.message || '积分中心加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  async loadTransactions() {
    if (!this.data.hasMore) return;
    this.setData({ loading: true });
    try {
      const pageSize = 20;
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'getTransactions', familyCode: this.data.familyCode, page: this.data.page, pageSize },
      });
      if (!result.result.success) throw new Error(result.result.message);
      const rows = result.result.data.map(item => ({
        ...item,
        amountText: item.amount > 0 ? `+${item.amount}` : String(item.amount),
        typeLabel: this.getTypeLabel(item.type),
        createdText: this.formatTime(item.created_at),
      }));
      this.setData({
        transactions: [...this.data.transactions, ...rows],
        page: this.data.page + 1,
        hasMore: rows.length === pageSize,
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '积分流水加载失败', icon: 'none' });
    }
  },

  async redeem(e) {
    const reward = this.data.catalog.find(item => item.code === e.currentTarget.dataset.code);
    if (!reward || !reward.canRedeem || this.data.actionLoading) return;
    const confirmed = await new Promise(resolve => wx.showModal({
      title: `兑换${reward.name}`,
      content: `将扣除 ${reward.points} 积分，提交后管理员会在 7 天内备货。`,
      confirmText: '确认兑换',
      success: result => resolve(result.confirm),
    }));
    if (!confirmed) return;

    const storageKey = `points_redeem_request_${reward.code}`;
    const requestId = wx.getStorageSync(storageKey) || `redeem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(storageKey, requestId);
    this.setData({ actionLoading: reward.code });
    try {
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'redeemReward', familyCode: this.data.familyCode, rewardCode: reward.code, quantity: 1, requestId },
      });
      if (!result.result.success) throw new Error(result.result.message);
      wx.removeStorageSync(storageKey);
      wx.showToast({ title: result.result.data.duplicate ? '兑换已提交' : '兑换成功', icon: 'success' });
      this.setData({ actionLoading: '', activeView: 'orders' });
      await this.refresh();
    } catch (err) {
      this.setData({ actionLoading: '' });
      wx.showToast({ title: err.message || '兑换失败，请稍后重试', icon: 'none' });
    }
  },

  async cancelRedemption(e) {
    const redemptionId = e.currentTarget.dataset.id;
    if (!redemptionId || this.data.actionLoading) return;
    const confirmed = await new Promise(resolve => wx.showModal({
      title: '取消兑换',
      content: '取消后积分将立即退回账户，确定继续吗？',
      confirmText: '取消兑换',
      confirmColor: '#b24a3a',
      success: result => resolve(result.confirm),
    }));
    if (!confirmed) return;

    this.setData({ actionLoading: redemptionId });
    try {
      const result = await wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'cancelRedemption', redemptionId } });
      if (!result.result.success) throw new Error(result.result.message);
      wx.showToast({ title: '已取消并退回积分', icon: 'success' });
      this.setData({ actionLoading: '' });
      await this.refresh();
    } catch (err) {
      this.setData({ actionLoading: '' });
      wx.showToast({ title: err.message || '取消失败', icon: 'none' });
    }
  },

  mapRedemption(item) {
    const statusMap = {
      pending: { label: '待备货', tone: 'pending', actionText: '可取消' },
      ready: { label: '待领取', tone: 'ready', actionText: '请出示领取码' },
      fulfilled: { label: '已发放', tone: 'fulfilled', actionText: '已完成' },
      canceled: { label: '已取消', tone: 'canceled', actionText: '积分已退回' },
    };
    return {
      ...item,
      ...statusMap[item.status],
      createdText: this.formatDate(item.created_at),
      dueText: this.formatDate(item.due_at),
    };
  },

  getTypeLabel(type) {
    return ({
      care_award: '养护入账', reward: '奖励入账', reversal: '积分冲正',
      redemption: '礼品兑换', redemption_refund: '兑换退款',
    })[type] || '积分调整';
  },

  formatDate(value) {
    if (!value) return '';
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  },

  formatTime(value) {
    if (!value) return '';
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${this.formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
});
