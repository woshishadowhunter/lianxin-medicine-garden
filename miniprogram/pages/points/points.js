Page({
  data: {
    familyCode: '',
    loading: true,
    account: { balance: 0, total_earned: 0, total_reversed: 0, transaction_count: 0 },
    transactions: [],
    baseRule: null,
    rewardRules: [],
    page: 1,
    hasMore: true,
  },

  onLoad() {
    this.setData({ familyCode: getApp().globalData.familyCode || wx.getStorageSync('familyCode') || '' });
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadTransactions();
  },

  async refresh() {
    if (!this.data.familyCode) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, page: 1, transactions: [], hasMore: true });

    try {
      const [accountRes, rulesRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getAccount', familyCode: this.data.familyCode } }),
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getRules' } }),
      ]);

      if (!accountRes.result.success) throw new Error(accountRes.result.message);
      this.setData({
        account: accountRes.result.data,
        baseRule: rulesRes.result.success ? rulesRes.result.data.base : null,
        rewardRules: rulesRes.result.success ? rulesRes.result.data.rewards : [],
      });
      await this.loadTransactions();
    } catch (err) {
      wx.showToast({ title: err.message || '积分账户加载失败', icon: 'none' });
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
        data: {
          action: 'getTransactions',
          familyCode: this.data.familyCode,
          page: this.data.page,
          pageSize,
        },
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
      wx.showToast({ title: err.message || '流水加载失败', icon: 'none' });
    }
  },

  getTypeLabel(type) {
    return ({ care_award: '养护入账', reward: '奖励入账', reversal: '积分冲正' })[type] || '积分调整';
  },

  formatTime(value) {
    if (!value) return '';
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },
});
