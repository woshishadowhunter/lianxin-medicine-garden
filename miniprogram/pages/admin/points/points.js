Page({
  data: {
    loading: true,
    issuing: false,
    summary: { account_count: 0, total_balance: 0, total_issued: 0, backfill_pending: 0 },
    accounts: [],
    filteredAccounts: [],
    familyLabels: [],
    recent: [],
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
        rewardRules: rules,
        rewardLabels: rules.map(item => `${item.name}（+${item.points}）`),
        loading: false,
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '积分银行加载失败', icon: 'none' });
    }
  },

  onFamilyChange(e) { this.setData({ selectedFamilyIndex: Number(e.detail.value) }); },
  onRewardChange(e) { this.setData({ selectedRewardIndex: Number(e.detail.value) }); },
  onNoteInput(e) { this.setData({ note: e.detail.value }); },

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

    this.setData({ issuing: true });
    try {
      const requestId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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

  formatTime(value) {
    if (!value) return '';
    const date = new Date(value.$date || value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  goDashboard() { wx.navigateBack(); },
});
