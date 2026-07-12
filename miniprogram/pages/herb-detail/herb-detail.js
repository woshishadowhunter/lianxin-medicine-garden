const { CARE_TYPES, PLANT_CATEGORIES } = require('../../utils/constants');
const { normalizePlantRecord, normalizePlantTask } = require('../../utils/plant');

Page({
  data: {
    taskId: '',
    task: null,
    records: [],
    loading: true,
  },

  onLoad(options) {
    this.setData({ taskId: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const db = wx.cloud.database();
      // 加载任务详情
      const taskRes = await db.collection('planting_tasks')
        .doc(this.data.taskId).get();
      const task = normalizePlantTask(taskRes.data);
      const plantDate = new Date(task.plant_date);
      task.elapsedDays = Number.isNaN(plantDate.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - plantDate.getTime()) / 86400000));
      task.categoryLabel = (PLANT_CATEGORIES.find(category => category.value === task.plant_category) || {}).label || '其他';
      task.sourceLabel = task.source === 'custom' ? '家庭自定义' : task.source === 'legacy' ? '原有种植任务' : '预设植物库';

      // 加载养护记录时间线
      const recordsRes = await db.collection('care_records')
        .where({ task_id: this.data.taskId })
        .orderBy('care_date', 'desc')
        .limit(50)
        .get();

      const records = recordsRes.data.map(r => ({
        ...normalizePlantRecord(r),
        typeIconName: (CARE_TYPES.find(c => c.value === r.care_type) || {}).iconName || 'record',
      }));

      this.setData({ task, records, loading: false });
    } catch (err) {
      console.error('加载详情失败:', err);
      this.setData({ loading: false });
    }
  },

  goAddRecord() {
    wx.switchTab({ url: '/pages/submit/submit' });
  },
});
