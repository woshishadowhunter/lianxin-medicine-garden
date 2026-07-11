const { HERBS, CARE_TYPES } = require('../../utils/constants');
const { daysUntilHarvest, formatDate } = require('../../utils/date');

Page({
  data: {
    archives: [],
    loading: true,
  },

  onLoad() {
    this.loadArchives();
  },

  async loadArchives() {
    const app = getApp();
    if (!app.globalData.familyCode) {
      this.setData({ loading: false });
      return;
    }

    try {
      const db = wx.cloud.database();
      const familyCode = app.globalData.familyCode;

      // 获取所有种植任务
      const tasksRes = await db.collection('planting_tasks')
        .where({ family_code: familyCode }).get();

      // 获取所有养护记录
      const recordsRes = await db.collection('care_records')
        .where({ family_code: familyCode, audit_status: 'confirmed' })
        .orderBy('care_date', 'asc')
        .limit(500)
        .get();

      const records = recordsRes.data;

      // 为每种药材构建生长档案
      const archives = tasksRes.data.map(task => {
        const herbConfig = HERBS.find(h => h.code === task.herb_code) || {};
        const taskRecords = records.filter(r => r.task_id === task._id);
        const harvestDays = daysUntilHarvest(task.plant_date, herbConfig.growth_days || 150);

        // 照片集合
        const allPhotos = taskRecords.flatMap(r =>
          (r.photos || []).map(p => ({ url: p, date: r.care_date, type: r.care_type }))
        );

        // 养护类型统计
        const careTypeStats = {};
        taskRecords.forEach(r => {
          careTypeStats[r.care_type] = (careTypeStats[r.care_type] || 0) + 1;
        });

        // 里程碑：首次养护、最近养护
        const firstRecord = taskRecords[0];
        const lastRecord = taskRecords[taskRecords.length - 1];

        return {
          id: task._id,
          herbName: task.herb_name,
          herbIconName: herbConfig.iconName || 'herb',
          herbCode: task.herb_code,
          plantDate: task.plant_date,
          status: task.status,
          growthDays: herbConfig.growth_days || 150,
          harvestDays,
          careCount: taskRecords.length,
          firstCareDate: firstRecord ? firstRecord.care_date : null,
          lastCareDate: lastRecord ? lastRecord.care_date : null,
          allPhotos,
          recentPhotos: allPhotos.slice(-6).map(p => p.url),
          careTypeStats,
          records: taskRecords.slice(-20), // 最近20条
        };
      });

      this.setData({ archives, loading: false });
    } catch (err) {
      console.error('加载档案失败:', err);
      this.setData({ loading: false });
    }
  },

  viewHerbDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/herb-detail/herb-detail?id=${id}` });
  },
});
