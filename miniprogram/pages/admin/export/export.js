Page({
  data: {
    exportTypes: [
      { value: 'all_records', label: '全部养护记录明细', desc: '包含所有家庭的每条养护记录', iconName: 'record' },
      { value: 'family_summary', label: '家庭养护统计汇总', desc: '200组家庭的养护次数排名', iconName: 'family' },
      { value: 'community_compare', label: '社区养护对比', desc: '各社区养护活跃度对比', iconName: 'community' },
      { value: 'herb_status', label: '药材生长状况统计', desc: '11种药材的生长状态分布', iconName: 'herb' },
      { value: 'points_ledger', label: '积分银行流水', desc: '家庭积分账户和逐笔交易明细', iconName: 'medal' },
      { value: 'annual_report', label: '年度综合报告（多Sheet）', desc: '一键导出全部统计报表', iconName: 'chart' },
    ],
    selectedType: 'all_records',
    dateStart: '',
    dateEnd: '',
    exporting: false,
    exportResult: null,
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
});
