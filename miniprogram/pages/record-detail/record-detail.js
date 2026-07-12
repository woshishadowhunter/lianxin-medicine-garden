const { CARE_TYPES, WEATHERS, GROWTH_STAGES } = require('../../utils/constants');
const { normalizePlantRecord } = require('../../utils/plant');

Page({
  data: {
    record: null,
    loading: true,
  },

  onLoad(options) {
    this.loadRecord(options.id);
  },

  async loadRecord(id) {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('care_records').doc(id).get();
      const record = normalizePlantRecord(res.data);
      const careType = CARE_TYPES.find(c => c.value === record.care_type);
      this.setData({
        record: {
          ...record,
          careTypeIconName: careType ? careType.iconName : 'record',
          careTypeLabel: careType ? careType.label : record.care_type,
        },
        loading: false,
      });
    } catch (err) {
      console.error('加载记录详情失败:', err);
      this.setData({ loading: false });
    }
  },

  previewPhoto(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.record.photos,
    });
  },
});
