Page({
  data: {
    loading: true,
    issuing: false,
    fulfillmentLoading: '',
    stockLoading: '',
    summary: {
      account_count: 0, total_balance: 0, total_issued: 0, total_redeemed: 0,
      backfill_pending: 0, fulfillment_pending: 0, fulfillment_ready: 0, fulfillment_overdue: 0,
    },
    accounts: [],
    filteredAccounts: [],
    familyLabels: [],
    recent: [],
    catalog: [],
    redemptions: [],
    filteredRedemptions: [],
    fulfillmentFilter: 'pending',
    queuePage: 1,
    queueHasMore: true,
    queueLoading: false,
    queueRequestToken: 0,
    rewardRules: [],
    rewardLabels: [],
    selectedFamilyIndex: 0,
    selectedRewardIndex: 0,
    note: '',
    searchText: '',
  },

  onShow() { this.loadData(); },

  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.queueHasMore && !this.data.queueLoading) this.loadFulfillmentQueue(false);
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [overviewRes, rulesRes] = await Promise.all([
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getAdminOverview' } }),
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getRules' } }),
      ]);
      if (!overviewRes.result.success) throw new Error(overviewRes.result.message);

      const data = overviewRes.result.data;
      const rules = rulesRes.result.success ? rulesRes.result.data.rewards : [];
      const accounts = data.accounts.map(item => ({ ...item, label: `${item.family_code} · ${item.community} · ${item.balance}分` }));
      this.setData({
        summary: data.summary,
        accounts,
        filteredAccounts: accounts,
        familyLabels: accounts.map(item => item.label),
        recent: data.recent.map(item => ({ ...item, amountText: item.amount > 0 ? `+${item.amount}` : String(item.amount), createdText: this.formatTime(item.created_at) })),
        catalog: data.catalog,
        rewardRules: rules,
        rewardLabels: rules.map(item => `${item.name}（+${item.points}）`),
      });
      await this.loadFulfillmentQueue(true);
      this.setData({ loading: false });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '积分兑现台加载失败', icon: 'none' });
    }
  },

  onFamilyChange(e) { this.setData({ selectedFamilyIndex: Number(e.detail.value) }); },
  onRewardChange(e) { this.setData({ selectedRewardIndex: Number(e.detail.value) }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },

  async switchFulfillmentFilter(e) {
    const fulfillmentFilter = e.currentTarget.dataset.status;
    this.setData({ fulfillmentFilter });
    await this.loadFulfillmentQueue(true);
  },

  async loadFulfillmentQueue(reset = false) {
    if ((!reset && this.data.queueLoading) || (!reset && !this.data.queueHasMore)) return;
    const page = reset ? 1 : this.data.queuePage;
    const pageSize = 30;
    const queueRequestToken = reset ? this.data.queueRequestToken + 1 : this.data.queueRequestToken;
    const status = this.data.fulfillmentFilter;
    this.setData({ queueLoading: true, queueRequestToken });
    try {
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'getFulfillmentQueue', status, page, pageSize },
      });
      if (queueRequestToken !== this.data.queueRequestToken) return;
      if (!result.result.success) throw new Error(result.result.message);
      const rows = result.result.data.map(item => this.mapRedemption(item));
      const redemptions = reset ? rows : [...this.data.redemptions, ...rows];
      this.setData({
        redemptions,
        filteredRedemptions: redemptions,
        queuePage: page + 1,
        queueHasMore: rows.length === pageSize,
        queueLoading: false,
      });
    } catch (err) {
      if (queueRequestToken !== this.data.queueRequestToken) return;
      this.setData({ queueLoading: false });
      wx.showToast({ title: err.message || '发放队列加载失败', icon: 'none' });
    }
  },

  loadMoreFulfillment() { this.loadFulfillmentQueue(false); },

  mapRedemption(item) {
    const statusMap = {
      pending: { statusLabel: '待备货', nextStatus: 'ready', nextLabel: '标记备货完成' },
      ready: { statusLabel: '待领取', nextStatus: 'fulfilled', nextLabel: '确认现场发放' },
      fulfilled: { statusLabel: '已发放', nextStatus: '', nextLabel: '' },
      canceled: { statusLabel: '已取消', nextStatus: '', nextLabel: '' },
    };
    return {
      ...item,
      ...statusMap[item.status],
      createdText: this.formatDate(item.created_at),
      dueText: this.formatDate(item.due_at),
    };
  },

  onSearchInput(e) {
    const searchText = String(e.detail.value || '').trim().toUpperCase();
    const filteredAccounts = this.data.accounts.filter(item => !searchText || item.family_code.includes(searchText) || item.community.includes(searchText));
    this.setData({ searchText, filteredAccounts });
  },

  async issueReward() {
    const account = this.data.accounts[this.data.selectedFamilyIndex];
    const rule = this.data.rewardRules[this.data.selectedRewardIndex];
    if (!account || !rule || this.data.issuing) return;

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认发放积分',
        content: `向 ${account.family_code} 发放「${rule.name}」奖励 ${rule.points} 积分？`,
        confirmText: '确认发放',
        success: result => resolve(result.confirm),
      });
    });
    if (!confirmed) return;

    const storageKey = `points_reward_request_${account.family_code}_${rule.code}`;
    const requestId = wx.getStorageSync(storageKey) || `reward_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(storageKey, requestId);
    this.setData({ issuing: true });
    try {
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: {
          action: 'grantReward',
          familyCode: account.family_code,
          rewardType: rule.code,
          note: this.data.note.trim(),
          requestId,
        },
      });
      if (!result.result.success) throw new Error(result.result.message);
      wx.removeStorageSync(storageKey);
      wx.showToast({ title: result.result.data.duplicate ? '该奖励已入账' : `已发放 ${rule.points} 积分`, icon: 'success' });
      this.setData({ note: '', issuing: false });
      await this.loadData();
    } catch (err) {
      this.setData({ issuing: false });
      wx.showToast({ title: err.message || '发放失败', icon: 'none' });
    }
  },

  async backfillConfirmed() {
    if (this.data.issuing || !this.data.summary.backfill_pending) return;
    this.setData({ issuing: true });
    try {
      const result = await wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'backfillConfirmed' } });
      if (!result.result.success) throw new Error(result.result.message);
      wx.showToast({ title: `已补发 ${result.result.data.processed} 条`, icon: 'success' });
      this.setData({ issuing: false });
      await this.loadData();
    } catch (err) {
      this.setData({ issuing: false });
      wx.showToast({ title: err.message || '补发失败', icon: 'none' });
    }
  },

  async updateFulfillment(e) {
    const redemptionId = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const redemption = this.data.redemptions.find(item => item.redemption_no === redemptionId);
    if (!redemption || this.data.fulfillmentLoading) return;
    const copy = status === 'ready'
      ? `确认「${redemption.reward_name}」已备好？家庭端将显示领取码。`
      : status === 'fulfilled'
        ? `请核对领取码 ${redemption.pickup_code}，确认礼品已经现场发放。`
        : `取消后将退回 ${redemption.points_cost} 积分并释放库存。`;
    const confirmation = await new Promise(resolve => wx.showModal({
      title: status === 'ready' ? '确认备货' : status === 'fulfilled' ? '核对领取码' : '取消兑换',
      content: status === 'fulfilled' ? '' : copy,
      editable: status === 'fulfilled',
      placeholderText: status === 'fulfilled' ? '请输入家庭出示的4位领取码' : '',
      confirmText: status === 'fulfilled' ? '核码并发放' : '确认',
      confirmColor: status === 'canceled' ? '#b24a3a' : '#2f6b52',
      success: result => resolve({ confirm: result.confirm, content: result.content || '' }),
    }));
    if (!confirmation.confirm) return;
    const pickupCode = status === 'fulfilled' ? confirmation.content.trim() : '';
    if (status === 'fulfilled' && !/^\d{4}$/.test(pickupCode)) {
      wx.showToast({ title: '请输入4位领取码', icon: 'none' });
      return;
    }

    this.setData({ fulfillmentLoading: redemptionId });
    try {
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'updateFulfillment', redemptionId, status, pickupCode },
      });
      if (!result.result.success) throw new Error(result.result.message);
      wx.showToast({ title: status === 'ready' ? '已通知领取' : status === 'fulfilled' ? '发放已登记' : '已取消并退款', icon: 'success' });
      this.setData({ fulfillmentLoading: '' });
      await this.loadData();
    } catch (err) {
      this.setData({ fulfillmentLoading: '' });
      wx.showToast({ title: err.message || '处理失败', icon: 'none' });
    }
  },

  async adjustStock(e) {
    const rewardCode = e.currentTarget.dataset.code;
    const delta = Number(e.currentTarget.dataset.delta);
    if (!rewardCode || !delta || this.data.stockLoading) return;
    const storageKey = `points_stock_request_${rewardCode}_${delta}`;
    const requestId = wx.getStorageSync(storageKey) || `stock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    wx.setStorageSync(storageKey, requestId);
    this.setData({ stockLoading: rewardCode });
    try {
      const result = await wx.cloud.callFunction({
        name: 'pointsBank',
        data: { action: 'adjustRewardStock', rewardCode, delta, requestId },
      });
      if (!result.result.success) throw new Error(result.result.message);
      wx.removeStorageSync(storageKey);
      wx.showToast({ title: delta > 0 ? `已入库 ${delta} 件` : `已减少 ${Math.abs(delta)} 件`, icon: 'success' });
      this.setData({ stockLoading: '' });
      await this.loadData();
    } catch (err) {
      this.setData({ stockLoading: '' });
      wx.showToast({ title: err.message || '库存调整失败', icon: 'none' });
    }
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
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  goDashboard() { wx.navigateBack(); },
});
