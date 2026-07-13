const { CARE_TYPES, COMMUNITIES } = require('../../../utils/constants');
const { normalizePlantRecord } = require('../../../utils/plant');

Page({
  data: {
    records: [],
    filter: 'pending',
    filterCommunity: '',
    filterHerb: '',
    filterType: '',
    page: 1,
    hasMore: true,
    loading: false,
    selectedIds: [],
    expandedId: null,
    stats: { pending: 0, today: 0, weekApproved: 0 },
    communities: ['全部社区', ...COMMUNITIES],
    careTypeOptions: ['全部类型', ...CARE_TYPES.map(item => item.label)],
    commentTemplates: ['照片不清晰，请重新拍摄', '缺少养护类型说明', '日期有误，请核实', '请补充文字描述', '养护记录完整，确认通过'],
  },

  onShow() {
    this.setData({ records: [], page: 1, hasMore: true, selectedIds: [] });
    this.loadStats();
    this.loadRecords();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadRecords();
  },

  async loadStats() {
    try {
      const db = wx.cloud.database();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [pendingRes, todayRes, weekApprovedRes] = await Promise.all([
        db.collection('care_records').where({ audit_status: 'pending' }).count(),
        db.collection('care_records').where({ created_at: db.command.gte(today) }).count(),
        db.collection('care_records').where({ audit_status: 'confirmed', audited_at: db.command.gte(new Date(Date.now() - 7 * 86400000)) }).count(),
      ]);
      this.setData({
        stats: { pending: pendingRes.total, today: todayRes.total, weekApproved: weekApprovedRes.total },
      });
    } catch (e) { /* ignore */ }
  },

  async loadRecords() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const PAGE_SIZE = 15;
      const conditions = {};
      if (this.data.filter !== 'all') conditions.audit_status = this.data.filter;

      let query = db.collection('care_records')
        .orderBy('created_at', 'desc')
        .skip((this.data.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE);

      if (Object.keys(conditions).length) query = query.where(conditions);

      const res = await query.get();

      // 前端筛选
      let filtered = res.data.map(normalizePlantRecord);
      if (this.data.filterCommunity) filtered = filtered.filter(r => r.family_code && r.family_code.includes(this.data.filterCommunity));
      if (this.data.filterHerb) filtered = filtered.filter(r => r.plant_name === this.data.filterHerb);
      if (this.data.filterType) filtered = filtered.filter(r => r.care_type === this.data.filterType);

      this.setData({
        records: [...this.data.records, ...filtered],
        hasMore: res.data.length === PAGE_SIZE,
        page: this.data.page + 1,
        loading: false,
      });
    } catch (err) {
      console.error('加载审核列表失败:', err);
      this.setData({ loading: false });
    }
  },

  // === 筛选 ===
  setFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.value });
    this.refresh();
  },

  setCommunity(e) {
    const community = this.data.communities[e.detail.value] || '';
    this.setData({ filterCommunity: community === '全部社区' ? '' : community });
    this.refresh();
  },

  setHerb(e) {
    this.setData({ filterHerb: e.detail.value || '' });
    this.refresh();
  },

  setType(e) {
    const index = Number(e.detail.value);
    const type = index > 0 ? CARE_TYPES[index - 1].value : '';
    this.setData({ filterType: type });
    this.refresh();
  },

  refresh() {
    this.setData({ records: [], page: 1, hasMore: true, selectedIds: [], expandedId: null });
    this.loadRecords();
  },

  // === 展开/收起 ===
  toggleExpand(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? null : id });
  },

  // === 选择 ===
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id;
    const { selectedIds } = this.data;
    const idx = selectedIds.indexOf(id);
    if (idx > -1) selectedIds.splice(idx, 1);
    else selectedIds.push(id);
    this.setSelection(selectedIds);
  },

  selectAll() {
    const allIds = this.data.records.map(r => r._id);
    this.setSelection(allIds);
  },

  clearSelection() {
    this.setSelection([]);
  },

  setSelection(selectedIds) {
    const records = this.data.records.map(record => ({
      ...record,
      _selected: selectedIds.includes(record._id),
    }));
    this.setData({ selectedIds, records });
  },

  // === 审核操作 ===
  async approve(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认通过',
      content: '审核通过后将向该家庭自动发放 10 积分。确定继续吗？',
      success: (res) => {
        if (res.confirm) this.auditAction([id], 'confirmed');
      },
    });
  },

  async batchApprove() {
    if (!this.data.selectedIds.length) {
      wx.showToast({ title: '请先选择记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '批量审核',
      content: `确认通过 ${this.data.selectedIds.length} 条记录？每条记录将自动发放 10 积分。`,
      success: (res) => {
        if (res.confirm) this.auditAction(this.data.selectedIds, 'confirmed');
      },
    });
  },

  async reject(e) {
    const id = e.currentTarget.dataset.id;
    wx.showActionSheet({
      itemList: this.data.commentTemplates,
      success: (res) => {
        const comment = this.data.commentTemplates[res.tapIndex];
        this.auditAction([id], 'needs_revision', comment);
      },
    });
  },

  async auditAction(ids, status, comment = '') {
    try {
      const result = await wx.cloud.callFunction({
        name: 'auditReview',
        data: { ids, status, comment },
      });
      if (!result.result.success) throw new Error(result.result.message);
      const pointsText = status === 'confirmed'
        ? `，发放 ${result.result.pointsIssued || 0} 积分`
        : result.result.pointsReversed ? `，冲正 ${result.result.pointsReversed} 积分` : '';
      wx.showToast({ title: `${status === 'confirmed' ? '已确认' : '已标记'}${pointsText}`, icon: 'none' });

      const records = this.data.records.filter(r => !ids.includes(r._id));
      this.setData({ records, selectedIds: [], expandedId: null });
      this.loadStats();
    } catch (err) {
      wx.showToast({ title: '操作失败，请重试', icon: 'none' });
    }
  },

  // === 查看记录详情 ===
  previewPhoto(e) {
    const { url, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: url, urls: urls.split(',') });
  },

  goDashboard() {
    wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
  },

  goFamilies() {
    wx.navigateTo({ url: '/pages/admin/families/families' });
  },

  goPoints() {
    wx.navigateTo({ url: '/pages/admin/points/points' });
  },

  goExport() {
    wx.navigateTo({ url: '/pages/admin/export/export' });
  },
});
