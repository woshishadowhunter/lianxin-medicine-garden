const { PLANT_STATUS, PLANT_CATEGORIES, PRESET_PLANTS } = require('../../utils/constants');
const { daysUntilHarvest } = require('../../utils/date');
const { normalizePlantTask } = require('../../utils/plant');

Page({
  data: {
    allTasks: [],
    tasks: [],
    loading: true,
    summary: { total: 0, growing: 0, warning: 0, dead: 0 },
    categories: [{ value: 'all', label: '全部' }, ...PLANT_CATEGORIES],
    selectedCategory: 'all',
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

      const tasks = res.data.map(rawTask => {
        const task = normalizePlantTask(rawTask);
        const plantConfig = PRESET_PLANTS.find(plant => plant.code === task.plant_code) || {};
        const totalDays = task.growth_days || plantConfig.growthDays || 0;
        const harvestDays = totalDays ? daysUntilHarvest(task.plant_date, totalDays) : 0;
        const elapsedDays = totalDays ? totalDays - harvestDays : Math.max(0, Math.floor((Date.now() - new Date(task.plant_date).getTime()) / 86400000));
        const progress = totalDays ? Math.min(100, Math.max(5, Math.round((elapsedDays / totalDays) * 100))) : 0;

        const statusInfo = PLANT_STATUS[task.status] || PLANT_STATUS.growing;
        if (task.status === 'growing') growingCount++;
        if (task.status === 'warning') warningCount++;
        if (task.status === 'dead') deadCount++;

        return {
          ...task,
          plantIconName: task.plant_icon_name || plantConfig.iconName || 'garden',
          categoryLabel: (PLANT_CATEGORIES.find(category => category.value === task.plant_category) || {}).label || '其他',
          harvestDays,
          elapsedDays,
          hasGrowthCycle: totalDays > 0,
          progress,
          statusLabel: statusInfo.label,
          statusIconName: statusInfo.iconName,
        };
      });

      this.setData({
        allTasks: tasks,
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

  selectCategory(e) {
    const selectedCategory = e.currentTarget.dataset.value;
    this.setData({
      selectedCategory,
      tasks: selectedCategory === 'all'
        ? this.data.allTasks
        : this.data.allTasks.filter(task => task.plant_category === selectedCategory),
    });
  },

  goAddPlant() {
    wx.navigateTo({ url: '/pages/plant-add/plant-add' });
  },
});
