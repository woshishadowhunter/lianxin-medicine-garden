const { CARE_TYPES, AUDIT_STATUS } = require('../../utils/constants');

Component({
  properties: {
    record: { type: Object, value: {} },
    showAudit: { type: Boolean, value: true },
    showPhotos: { type: Boolean, value: true },
  },

  data: {
    typeIconName: '',
    typeLabel: '',
    statusLabel: '',
    statusClass: '',
  },

  observers: {
    'record'(record) {
      if (!record) return;
      const careType = CARE_TYPES.find(c => c.value === record.care_type);
      const auditStatus = AUDIT_STATUS[record.audit_status];
      this.setData({
        typeIconName: careType ? careType.iconName : 'record',
        typeLabel: careType ? careType.label : record.care_type,
        statusLabel: auditStatus ? auditStatus.label : '待审核',
        statusClass: auditStatus ? auditStatus.color : 'tag-pending',
      });
    },
  },

  methods: {
    onTap() { this.triggerEvent('tap', { record: this.properties.record }); },
    onPreview(e) {
      const { url } = e.currentTarget.dataset;
      wx.previewImage({ current: url, urls: this.properties.record.photos });
    },
  },
});
