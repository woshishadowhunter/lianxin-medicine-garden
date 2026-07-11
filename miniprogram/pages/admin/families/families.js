const { COMMUNITIES } = require('../../../utils/constants');

Page({
  data: {
    families: [],
    communities: COMMUNITIES,
    filterCommunity: '',
    searchKeyword: '',
    page: 1,
    hasMore: true,
    loading: false,
    stats: { total: 0, active: 0, inactive: 0 },
  },

  onShow() {
    this.setData({ families: [], page: 1, hasMore: true });
    this.loadStats();
    this.loadFamilies();
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) this.loadFamilies();
  },

  async loadStats() {
    try {
      const db = wx.cloud.database();
      const totalRes = await db.collection('families').count();
      this.setData({ 'stats.total': totalRes.total });
    } catch (e) { /* ignore */ }
  },

  async loadFamilies() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const db = wx.cloud.database();
      const PAGE_SIZE = 20;

      let query = db.collection('families')
        .orderBy('family_code', 'asc')
        .skip((this.data.page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE);

      if (this.data.filterCommunity) {
        query = query.where({ community: this.data.filterCommunity });
      }

      const res = await query.get();

      let filtered = res.data;
      if (this.data.searchKeyword) {
        const kw = this.data.searchKeyword.toUpperCase();
        filtered = filtered.filter(f => f.family_code.includes(kw));
      }

      // 计算每家庭活跃度
      const enriched = await this.enrichFamilies(filtered);

      this.setData({
        families: [...this.data.families, ...enriched],
        hasMore: res.data.length === PAGE_SIZE,
        page: this.data.page + 1,
        loading: false,
      });
    } catch (err) {
      console.error('加载家庭列表失败:', err);
      this.setData({ loading: false });
    }
  },

  async enrichFamilies(families) {
    try {
      const db = wx.cloud.database();
      const codes = families.map(f => f.family_code);

      // 批量获取每家庭的最近养护时间
      const recordRes = await db.collection('care_records')
        .where({ family_code: db.command.in(codes) })
        .get();

      const taskRes = await db.collection('planting_tasks')
        .where({ family_code: db.command.in(codes) })
        .get();

      const careCounts = {};
      const lastCare = {};
      recordRes.data.forEach(r => {
        careCounts[r.family_code] = (careCounts[r.family_code] || 0) + 1;
        if (!lastCare[r.family_code] || r.care_date > lastCare[r.family_code]) {
          lastCare[r.family_code] = r.care_date;
        }
      });

      const taskCounts = {};
      taskRes.data.forEach(t => {
        taskCounts[t.family_code] = (taskCounts[t.family_code] || 0) + 1;
      });

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

      return families.map(f => {
        const last = lastCare[f.family_code];
        const isActive = last ? new Date(last) >= sevenDaysAgo : false;
        return {
          ...f,
          careCount: careCounts[f.family_code] || 0,
          taskCount: taskCounts[f.family_code] || 0,
          lastCareDate: last || '暂无记录',
          isActive,
          statusLabel: isActive ? '活跃' : last ? '不活跃' : '未开始',
          statusClass: isActive ? 'text-success' : last ? 'text-warning' : 'text-hint',
        };
      });
    } catch (e) {
      return families;
    }
  },

  // === 筛选 ===
  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value, families: [], page: 1, hasMore: true });
    this.loadFamilies();
  },

  onCommunityFilter(e) {
    const idx = parseInt(e.detail.value);
    this.setData({
      filterCommunity: idx === 0 ? '' : COMMUNITIES[idx - 1],
      families: [], page: 1, hasMore: true,
    });
    this.loadFamilies();
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/admin/families/family-detail/family-detail?id=${e.currentTarget.dataset.id}`,
    });
  },
});
