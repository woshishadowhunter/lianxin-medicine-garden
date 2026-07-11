const { CARE_TYPES, HERBS } = require('../../utils/constants');

Page({
  data: {
    records: [],
    filter: { herbCode: '', careType: '', dateStart: '', dateEnd: '' },
    herbOptions: [],
    careTypeOptions: CARE_TYPES,
    activeFilter: '',
    viewMode: 'timeline',
    page: 1,
    hasMore: true,
    loading: false,
    stats: [],
  },

  onShow() {
    this.setData({ records: [], page: 1, hasMore: true });
    this.loadHerbOptions();
    this.loadRecords();
  },

  onPullDownRefresh() {
    this.setData({ records: [], page: 1, hasMore: true, stats: [] });
    Promise.all([this.loadHerbOptions(), this.loadRecords()])
      .then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadRecords();
  },

  async loadHerbOptions() {
    const app = getApp();
    if (!app.globalData.familyCode) return;
    try {
      const db = wx.cloud.database();
      const res = await db.collection('planting_tasks')
        .where({ family_code: app.globalData.familyCode }).get();
      this.setData({ herbOptions: res.data });
    } catch (err) { /* ignore */ }
  },

  async loadRecords() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      const app = getApp();
      const db = wx.cloud.database();
      const PAGE_SIZE = 15;
      const { filter } = this.data;

      let query = db.collection('care_records')
        .where({ family_code: app.globalData.familyCode })
        .orderBy('care_date', 'desc')
        .skip((this.data.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE);

      const res = await query.get();

      // 前端筛选（云数据库不支持复杂组合查询）
      let filtered = res.data;
      if (filter.herbCode) filtered = filtered.filter(r => r.herb_code === filter.herbCode);
      if (filter.careType) filtered = filtered.filter(r => r.care_type === filter.careType);
      if (filter.dateStart) filtered = filtered.filter(r => r.care_date >= filter.dateStart);
      if (filter.dateEnd) filtered = filtered.filter(r => r.care_date <= filter.dateEnd);

      this.setData({
        records: [...this.data.records, ...filtered],
        hasMore: res.data.length === PAGE_SIZE,
        page: this.data.page + 1,
        loading: false,
      });
    } catch (err) {
      console.error('加载记录失败:', err);
      this.setData({ loading: false });
    }
  },

  /** 筛选器 */
  onFilterTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeFilter: this.data.activeFilter === key ? '' : key });
  },

  onHerbFilter(e) {
    const code = this.data.herbOptions[e.detail.value]?.herb_code || '';
    this.setData({ 'filter.herbCode': code, records: [], page: 1, hasMore: true, activeFilter: '' });
    this.loadRecords();
  },

  onCareTypeFilter(e) {
    const type = CARE_TYPES[e.detail.value]?.value || '';
    this.setData({ 'filter.careType': type, records: [], page: 1, hasMore: true, activeFilter: '' });
    this.loadRecords();
  },

  onDateStartChange(e) {
    this.setData({ 'filter.dateStart': e.detail.value, records: [], page: 1, hasMore: true, activeFilter: '' });
    this.loadRecords();
  },

  onDateEndChange(e) {
    this.setData({ 'filter.dateEnd': e.detail.value, records: [], page: 1, hasMore: true, activeFilter: '' });
    this.loadRecords();
  },

  clearFilters() {
    this.setData({ filter: { herbCode: '', careType: '', dateStart: '', dateEnd: '' }, records: [], page: 1, hasMore: true });
    this.loadRecords();
  },

  toggleViewMode() {
    this.setData({ viewMode: this.data.viewMode === 'timeline' ? 'grid' : 'timeline' });
  },

  viewDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/record-detail/record-detail?id=${id}` });
  },

  goSubmit() {
    wx.switchTab({ url: '/pages/submit/submit' });
  },

  /** 获取所有筛选后的照片用于照片墙 */
  get allPhotos() {
    return this.data.records.flatMap(r =>
      (r.photos || []).map(photo => ({ photo, id: r._id, date: r.care_date, herb: r.herb_name }))
    );
  },
});
