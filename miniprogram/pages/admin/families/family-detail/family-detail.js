Page({
  data: {
    familyId: '',
    family: null,
    tasks: [],
    records: [],
    loading: true,
  },

  onLoad(options) {
    this.setData({ familyId: options.id });
    this.loadDetail();
  },

  async loadDetail() {
    try {
      const db = wx.cloud.database();
      const familyRes = await db.collection('families').doc(this.data.familyId).get();
      const family = familyRes.data;

      const [tasksRes, recordsRes] = await Promise.all([
        db.collection('planting_tasks').where({ family_code: family.family_code }).get(),
        db.collection('care_records')
          .where({ family_code: family.family_code })
          .orderBy('care_date', 'desc')
          .limit(50)
          .get(),
      ]);

      this.setData({
        family,
        tasks: tasksRes.data,
        records: recordsRes.data,
        loading: false,
      });
    } catch (err) {
      console.error('加载家庭详情失败:', err);
      this.setData({ loading: false });
    }
  },
});
