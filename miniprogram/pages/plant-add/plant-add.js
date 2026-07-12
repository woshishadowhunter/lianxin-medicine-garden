const { PLANT_CATEGORIES, PRESET_PLANTS } = require('../../utils/constants');
const { validatePlantInput } = require('../../utils/plant');
const { ensureRequestId, filterPlants, getCategoryLabel } = require('./view-model');
const { formatDate } = require('../../utils/date');

Page({
  data: {
    mode: 'catalog',
    familyCode: '',
    categories: [{ value: 'all', label: '全部' }, ...PLANT_CATEGORIES],
    customCategories: PLANT_CATEGORIES,
    selectedCategory: 'all',
    catalog: [],
    filteredCatalog: [],
    keyword: '',
    selectedPlant: null,
    nickname: '',
    customName: '',
    customCategory: 'flower',
    plantDate: '',
    today: '',
    growthDays: '',
    coverImage: '',
    coverCloudPath: '',
    requestId: '',
    loading: true,
    submitting: false,
    error: '',
  },

  onLoad() {
    const app = getApp();
    const familyCode = String(app.globalData.familyCode || wx.getStorageSync('familyCode') || '').trim().toUpperCase();
    const today = formatDate(new Date());
    this.setData({ familyCode, today, plantDate: today });
    this.loadCatalog();
  },

  async loadCatalog() {
    this.setData({ loading: true, error: '' });
    try {
      const result = await wx.cloud.callFunction({ name: 'plantManager', data: { action: 'listCatalog' } });
      if (!result.result || !result.result.success) throw new Error(result.result && result.result.message || '植物库加载失败');
      const catalog = (result.result.data || []).map(plant => ({
        ...plant,
        categoryLabel: getCategoryLabel(plant.category),
      }));
      this.setData({ catalog, filteredCatalog: catalog, loading: false });
    } catch (error) {
      const catalog = PRESET_PLANTS.map(plant => ({
        ...plant,
        icon_name: plant.iconName,
        growth_days: plant.growthDays,
        categoryLabel: getCategoryLabel(plant.category),
      }));
      this.setData({
        catalog,
        filteredCatalog: catalog,
        loading: false,
        error: '当前显示本地植物目录，部署植物目录后即可添加。',
      });
    }
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, error: '' });
  },

  selectCategory(e) {
    const selectedCategory = e.currentTarget.dataset.value;
    this.setData({ selectedCategory });
    this.applyFilters(selectedCategory, this.data.keyword);
  },

  onKeywordInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.applyFilters(this.data.selectedCategory, keyword);
  },

  applyFilters(category, keyword) {
    this.setData({ filteredCatalog: filterPlants(this.data.catalog, category, keyword) });
  },

  selectPlant(e) {
    this.setData({ selectedPlant: e.currentTarget.dataset.plant, nickname: '', error: '' });
  },

  clearSelection() {
    this.setData({ selectedPlant: null, nickname: '' });
  },

  onFieldInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  selectCustomCategory(e) {
    this.setData({ customCategory: e.currentTarget.dataset.value });
  },

  chooseCover() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: result => {
        const file = result.tempFiles && result.tempFiles[0];
        if (file) this.setData({ coverImage: file.tempFilePath, coverCloudPath: '' });
      },
    });
  },

  removeCover() {
    this.setData({ coverImage: '', coverCloudPath: '' });
  },

  async uploadCover(requestId) {
    if (!this.data.coverImage) return '';
    if (this.data.coverCloudPath) return this.data.coverCloudPath;
    const extension = (this.data.coverImage.match(/\.[A-Za-z0-9]+$/) || ['.jpg'])[0];
    const result = await wx.cloud.uploadFile({
      cloudPath: `families/${this.data.familyCode}/plants/${requestId}${extension}`,
      filePath: this.data.coverImage,
    });
    this.setData({ coverCloudPath: result.fileID });
    return result.fileID;
  },

  async submitPlant() {
    if (this.data.submitting) return;
    if (!this.data.familyCode) {
      this.setData({ error: '请先绑定家庭账号。' });
      return;
    }
    if (this.data.mode === 'catalog' && !this.data.selectedPlant) {
      this.setData({ error: '请先选择一种植物。' });
      return;
    }

    const requestId = ensureRequestId(this.data.requestId);
    this.setData({ requestId, submitting: true, error: '' });
    try {
      let data;
      if (this.data.mode === 'custom') {
        const validated = validatePlantInput({
          name: this.data.customName,
          category: this.data.customCategory,
          plantDate: this.data.plantDate,
          growthDays: this.data.growthDays,
        }, this.data.today);
        const coverImage = await this.uploadCover(requestId);
        data = {
          action: 'createCustomTask',
          familyCode: this.data.familyCode,
          requestId,
          ...validated,
          coverImage,
        };
      } else {
        const coverImage = await this.uploadCover(requestId);
        data = {
          action: 'createPresetTask',
          familyCode: this.data.familyCode,
          requestId,
          plantCode: this.data.selectedPlant.code,
          nickname: String(this.data.nickname || '').trim(),
          plantDate: this.data.plantDate,
          coverImage,
        };
      }

      const result = await wx.cloud.callFunction({ name: 'plantManager', data });
      if (!result.result || !result.result.success) throw new Error(result.result && result.result.message || '添加植物失败');
      wx.showToast({ title: '植物已加入', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      this.setData({ submitting: false, error: error.message || '添加植物失败，请重试。' });
    }
  },
});
