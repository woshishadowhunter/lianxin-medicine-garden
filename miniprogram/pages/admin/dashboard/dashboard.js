const { CARE_TYPES } = require('../../../utils/constants');
const { normalizePlantTask } = require('../../../utils/plant');

Page({
  data: {
    loading: true,
    stats: [],
    weeklyTrend: null,
    careDistribution: null,
    communityRank: null,
    herbStats: null,
    recentActivity: [],
  },

  onShow() {
    this.loadAll();
  },

  async loadAll() {
    try {
      const db = wx.cloud.database();

      // 并行加载基础数据
      const [
        familyRes, recordRes, taskRes,
        weeklyRes, careTypeRes
      ] = await Promise.all([
        db.collection('families').count(),
        db.collection('care_records').count(),
        db.collection('planting_tasks').count(),
        this.getWeeklyTrend(),
        this.getCareTypeDistribution(),
      ]);

      // 统计卡片
      const survivalRes = await db.collection('planting_tasks')
        .where({ status: 'growing' }).count();

      this.setData({
        stats: [
          { label: '参与家庭', value: familyRes.total, iconName: 'family' },
          { label: '养护记录', value: recordRes.total, iconName: 'record' },
          { label: '种植任务', value: taskRes.total, iconName: 'herb' },
          { label: '存活率', value: taskRes.total ? Math.round(survivalRes.total / taskRes.total * 100) + '%' : '0%', iconName: 'check', color: 'var(--primary)' },
        ],
        weeklyTrend: weeklyRes,
        careDistribution: careTypeRes,
        loading: false,
      });

      // 社区排名和植物统计（可以略微延迟加载）
      this.loadSecondaryCharts();

    } catch (err) {
      console.error('加载管理数据失败:', err);
      this.setData({ loading: false });
    }
  },

  /** 本周养护趋势（柱状图） */
  async getWeeklyTrend() {
    try {
      const db = wx.cloud.database();
      const today = new Date();
      const labels = [];
      const data = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        labels.push(dateStr.slice(5)); // MM-DD
        data.push(0);
      }

      // 查询最近7天每天的记录数
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const res = await db.collection('care_records')
        .where({ created_at: db.command.gte(sevenDaysAgo) })
        .get();

      res.data.forEach(r => {
        const d = r.care_date;
        const idx = labels.findIndex(l => l === d.slice(5));
        if (idx >= 0) data[idx]++;
      });

      return { labels, series: [{ name: '养护次数', data, color: '#1f6b4b' }] };
    } catch (e) { return null; }
  },

  /** 养护类型分布（饼图） */
  async getCareTypeDistribution() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('care_records').get();
      const counts = {};
      res.data.forEach(r => { counts[r.care_type] = (counts[r.care_type] || 0) + 1; });

      const labels = [];
      const data = [];
      CARE_TYPES.forEach(ct => {
        if (counts[ct.value]) {
          labels.push(ct.label);
          data.push(counts[ct.value]);
        }
      });

      return { labels, data };
    } catch (e) { return null; }
  },

  /** 社区排名 + 植物统计 */
  async loadSecondaryCharts() {
    try {
      const db = wx.cloud.database();

      // 社区养护排名
      const recordsRes = await db.collection('care_records').get();
      const familyRes = await db.collection('families').get();

      const codeToCommunity = {};
      familyRes.data.forEach(f => { codeToCommunity[f.family_code] = f.community; });

      const communityCounts = {};
      recordsRes.data.forEach(r => {
        const com = codeToCommunity[r.family_code] || '未知';
        communityCounts[com] = (communityCounts[com] || 0) + 1;
      });

      const sortedCom = Object.entries(communityCounts)
        .sort((a, b) => b[1] - a[1]);
      const communityRank = {
        labels: sortedCom.map(e => e[0]),
        series: [{ name: '养护次数', data: sortedCom.map(e => e[1]), color: '#b98b45' }],
      };

      // 植物种植统计
      const tasksRes = await db.collection('planting_tasks').get();
      const herbCounts = {};
      tasksRes.data.map(normalizePlantTask).forEach(task => {
        herbCounts[task.plant_name] = (herbCounts[task.plant_name] || 0) + 1;
      });

      const sortedHerbs = Object.entries(herbCounts).sort((a, b) => b[1] - a[1]);
      const herbStats = {
        labels: sortedHerbs.map(e => e[0]),
        series: [{ name: '种植数量', data: sortedHerbs.map(e => e[1]), color: '#3d739c' }],
      };

      this.setData({ communityRank, herbStats });
    } catch (e) { /* ignore */ }
  },

  // === 导航 ===
  goAudit() { wx.navigateTo({ url: '/pages/admin/audit/audit' }); },
  goFamilies() { wx.navigateTo({ url: '/pages/admin/families/families' }); },
  goPoints() { wx.navigateTo({ url: '/pages/admin/points/points' }); },
  goExport() { wx.navigateTo({ url: '/pages/admin/export/export' }); },

  switchToUser() {
    const app = getApp();
    app.globalData.isAdmin = false;
    wx.setStorageSync('isAdmin', false);
    wx.showToast({ title: '已切换为普通用户', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 800);
  },
});
