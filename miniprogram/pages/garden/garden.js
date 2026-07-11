const { HERB_STATUS, HERBS } = require('../../utils/constants');
const { daysUntilHarvest } = require('../../utils/date');

Page({
  data: {
    tasks: [],
    loading: true,
    summary: { total: 0, growing: 0, warning: 0, dead: 0 },
  },

  onShow() {
    this.loadTasks();
  },

  async loadTasks() {
    const app = getApp();
    if (!app.globalData.familyCode) {
      this.setData({ loading: false });
      return;
    }

    try {
      const db = wx.cloud.database();
      const res = await db.collection('planting_tasks')
        .where({ family_code: app.globalData.familyCode })
        .orderBy('status', 'asc')
        .get();

      let growingCount = 0, warningCount = 0, deadCount = 0;

      const tasks = res.data.map(task => {
        const herbConfig = HERBS.find(h => h.code === task.herb_code) || {};
        const harvestDays = daysUntilHarvest(task.plant_date, herbConfig.growthDays || 150);
        const totalDays = herbConfig.growthDays || 150;
        const elapsedDays = totalDays - harvestDays;
        const progress = Math.min(100, Math.max(5, Math.round((elapsedDays / totalDays) * 100)));

        const statusInfo = HERB_STATUS[task.status] || HERB_STATUS.growing;
        if (task.status === 'growing') growingCount++;
        if (task.status === 'warning') warningCount++;
        if (task.status === 'dead') deadCount++;

        return {
          ...task,
          herbIconName: herbConfig.iconName || 'herb',
          harvestDays,
          progress,
          statusLabel: statusInfo.label,
          statusIconName: statusInfo.iconName,
        };
      });

      this.setData({
        tasks,
        summary: {
          total: tasks.length,
          growing: growingCount,
          warning: warningCount,
          dead: deadCount,
        },
        loading: false,
      });
    } catch (err) {
      console.error('加载任务失败:', err);
      this.setData({ loading: false });
    }
  },

  goDetail(e) {
    wx.navigateTo({ url: `/pages/herb-detail/herb-detail?id=${e.currentTarget.dataset.id}` });
  },

  goGrowthArchive() {
    wx.navigateTo({ url: '/pages/growth-archive/growth-archive' });
  },
});
