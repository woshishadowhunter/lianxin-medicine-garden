const { runPlantMigration } = require('./migration');

Page({
  data: {
    exportTypes: [
      { value: 'all_records', label: '全部养护记录明细', desc: '包含所有家庭的每条养护记录', iconName: 'record' },
      { value: 'family_summary', label: '家庭养护统计汇总', desc: '200组家庭的养护次数排名', iconName: 'family' },
      { value: 'community_compare', label: '社区养护对比', desc: '各社区养护活跃度对比', iconName: 'community' },
      { value: 'plant_status', label: '植物生长状况统计', desc: '按类别和名称统计植物生长状态', iconName: 'garden' },
      { value: 'points_ledger', label: '积分银行流水', desc: '家庭积分账户和逐笔交易明细', iconName: 'medal' },
      { value: 'annual_report', label: '年度综合报告（多Sheet）', desc: '一键导出全部统计报表', iconName: 'chart' },
    ],
    selectedType: 'all_records',
    dateStart: '',
    dateEnd: '',
    exporting: false,
    exportResult: null,
    migrating: false,
    migrationStatus: '',
    migrationResult: null,
  },

  onSelectType(e) {
    this.setData({ selectedType: e.currentTarget.dataset.type });
  },

  onStartDateChange(e) { this.setData({ dateStart: e.detail.value }); },
  onEndDateChange(e) { this.setData({ dateEnd: e.detail.value }); },

  async doExport() {
    if (this.data.exporting) return;

    wx.showModal({
      title: '确认导出',
      content: `确定导出「${this.getSelectedLabel()}」吗？`,
      success: async (res) => {
        if (!res.confirm) return;

        this.setData({ exporting: true, exportResult: null });

        try {
          const result = await wx.cloud.callFunction({
            name: 'exportData',
            data: {
              type: this.data.selectedType,
              dateRange: this.data.dateStart ? [this.data.dateStart, this.data.dateEnd] : [],
            },
          });

          if (result.result.success) {
            this.setData({
              exporting: false,
              exportResult: {
                success: true,
                fileUrl: result.result.fileUrl,
                format: result.result.format || 'xlsx',
              },
            });
          } else {
            this.setData({
              exporting: false,
              exportResult: { success: false, message: result.result.message },
            });
          }
        } catch (err) {
          this.setData({
            exporting: false,
            exportResult: { success: false, message: '导出失败，请重试' },
          });
        }
      },
    });
  },

  getSelectedLabel() {
    const t = this.data.exportTypes.find(t => t.value === this.data.selectedType);
    return t ? t.label : '';
  },

  downloadFile() {
    if (!this.data.exportResult || !this.data.exportResult.fileUrl) return;

    wx.showLoading({ title: '下载中...' });
    wx.downloadFile({
      url: this.data.exportResult.fileUrl,
      success: (res) => {
        wx.hideLoading();
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          success: () => wx.showToast({ title: '打开成功', icon: 'success' }),
          fail: () => wx.showToast({ title: '请在文件管理器中查看', icon: 'none' }),
        });
      },
      fail: () => {
        wx.hideLoading();
        // 备选：复制链接
        wx.setClipboardData({
          data: this.data.exportResult.fileUrl,
          success: () => wx.showToast({ title: '链接已复制', icon: 'none' }),
        });
      },
    });
  },

  startPlantMigration() {
    if (this.data.migrating) return;
    wx.showModal({
      title: '升级植物数据',
      content: '将写入通用植物目录，并为旧任务和记录补充兼容字段。过程可重复执行，不会删除旧数据。',
      confirmText: '开始升级',
      success: async result => {
        if (!result.confirm) return;
        this.setData({ migrating: true, migrationStatus: '正在写入植物目录…', migrationResult: null });
        try {
          const summary = await runPlantMigration(
            async data => {
              const response = await wx.cloud.callFunction({ name: 'migratePlants', data });
              return response.result;
            },
            progress => {
              const labels = {
                catalog: '正在写入植物目录…',
                planting_tasks: `正在升级植物任务，已检查 ${progress.processed} 条`,
                care_records: `正在升级养护记录，已检查 ${progress.processed} 条`,
                complete: '植物数据升级完成',
              };
              this.setData({ migrationStatus: labels[progress.phase] || '正在升级…' });
            },
          );
          this.setData({ migrating: false, migrationResult: summary });
          wx.showToast({ title: '升级完成', icon: 'success' });
        } catch (error) {
          this.setData({ migrating: false, migrationStatus: error.message || '升级失败，请重试' });
          wx.showToast({ title: '升级失败', icon: 'none' });
        }
      },
    });
  },
});
