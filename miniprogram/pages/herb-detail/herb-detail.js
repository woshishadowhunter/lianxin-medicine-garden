const { CARE_TYPES } = require('../../utils/constants');
const { daysUntilHarvest, formatDate } = require('../../utils/date');

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
      const app = getApp();

      // 加载任务详情
      const taskRes = await db.collection('planting_tasks')
        .doc(this.data.taskId).get();
      const task = taskRes.data;

      // 加载养护记录时间线
      const recordsRes = await db.collection('care_records')
        .where({ task_id: this.data.taskId })
        .orderBy('care_date', 'desc')
        .limit(50)
        .get();

      const records = recordsRes.data.map(r => ({
        ...r,
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
