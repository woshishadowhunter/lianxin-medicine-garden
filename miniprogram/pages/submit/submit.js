const { CARE_TYPES, WEATHERS, GROWTH_STAGES } = require('../../utils/constants');
const { formatDate, generateId } = require('../../utils/date');
const { compressImages, addWatermarks, uploadPhoto, getCloudPath } = require('../../utils/photo');
const { isOnline, saveOffline, getQueueCount } = require('../../utils/offline');
const { normalizePlantTask } = require('../../utils/plant');

Page({
  data: {
    step: 'select-herb',
    herbs: [],
    selectedHerb: null,
    selectedCareType: '',
    selectedCareTypeLabel: '',
    photos: [],
    photoProgress: {},   // { index: percent }
    description: '',
    weather: '',
    growthStage: '',
    weathers: WEATHERS,
    growthStages: GROWTH_STAGES,
    careDate: formatDate(new Date()),
    careTime: '',
    submitting: false,
    uploadProgress: [],
    totalProgress: 0,
    isOnline: true,
    pendingCount: 0,
    familyCode: '',
    herbsLoading: false,
    herbsError: '',
  },

  onLoad() {
    const now = new Date();
    this.setData({
      careTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    });
  },

  onShow() {
    this.resolveFamilyCode();
    this.loadMyHerbs();
    this.checkNetwork();
    this.setData({ pendingCount: getQueueCount() });
  },

  resolveFamilyCode() {
    const app = getApp();
    const storedCode = wx.getStorageSync('familyCode');
    const familyCode = String(app.globalData.familyCode || storedCode || '').trim().toUpperCase();
    if (familyCode && app.globalData.familyCode !== familyCode) {
      app.globalData.familyCode = familyCode;
      wx.setStorageSync('familyCode', familyCode);
    }
    this.setData({ familyCode });
    return familyCode;
  },

  async checkNetwork() {
    const online = await isOnline();
    this.setData({ isOnline: online });
  },

  async loadMyHerbs() {
    const familyCode = this.data.familyCode || this.resolveFamilyCode();
    if (!familyCode) {
      this.setData({ herbs: [], herbsLoading: false, herbsError: '' });
      return;
    }

    this.setData({ herbsLoading: true, herbsError: '' });
    try {
      const db = wx.cloud.database();

      // 优先查生长中的任务
      let res = await db.collection('planting_tasks')
        .where({ family_code: familyCode, status: 'growing' })
        .get();

      // 如果生长中的为空，回退显示该家庭全部植物（不限状态）
      if (!res.data.length) {
        res = await db.collection('planting_tasks')
          .where({ family_code: familyCode })
          .get();
        if (!res.data.length) {
          this.setData({
            herbs: [],
            herbsLoading: false,
            herbsError: `家庭 ${familyCode} 暂无植物，请先在植物园中添加`
          });
          return;
        }
        // 有任务但不是 growing 状态
        this.setData({ herbs: res.data.map(normalizePlantTask), herbsLoading: false });
        wx.showToast({ title: `已加载 ${res.data.length} 株植物（含非生长中状态）`, icon: 'none', duration: 2500 });
        return;
      }

      this.setData({ herbs: res.data.map(normalizePlantTask), herbsLoading: false });
    } catch (err) {
      console.error('加载任务失败:', err);
      this.setData({ herbs: [], herbsLoading: false });
      const msg = err.errMsg || err.message || '数据库查询失败';
      this.setData({ herbsError: msg });
      wx.showToast({ title: '加载植物失败，下拉刷新重试', icon: 'none' });
    }
  },

  // === 步骤导航 ===
  selectHerb(e) {
    const herb = e.currentTarget.dataset.herb;
    this.setData({ selectedHerb: herb, step: 'select-type' });
  },

  onCareTypeChange(e) {
    const selectedCareType = e.detail.value;
    const type = CARE_TYPES.find(item => item.value === selectedCareType);
    this.setData({
      selectedCareType,
      selectedCareTypeLabel: type ? type.label : selectedCareType,
      step: 'upload-photo',
    });
  },

  // === 照片管理 ===
  choosePhoto() {
    const remaining = 9 - this.data.photos.length;
    if (remaining <= 0) {
      wx.showToast({ title: '最多9张照片', icon: 'none' });
      return;
    }

    wx.showActionSheet({
      itemList: ['拍照', '从相册选择'],
      success: (res) => {
        const sourceType = res.tapIndex === 0 ? ['camera'] : ['album'];
        wx.chooseMedia({
          count: remaining,
          mediaType: ['image'],
          sourceType,
          success: (result) => {
            const newPhotos = result.tempFiles.map(f => ({
              path: f.tempFilePath,
              size: f.size,
              uploaded: false,
            }));
            this.setData({ photos: [...this.data.photos, ...newPhotos] });
          },
        });
      },
    });
  },

  deletePhoto(e) {
    const index = e.currentTarget.dataset.index;
    const photos = this.data.photos.filter((_, i) => i !== index);
    this.setData({ photos });
  },

  previewPhoto(e) {
    const index = e.currentTarget.dataset.index;
    wx.previewImage({
      current: this.data.photos[index].path,
      urls: this.data.photos.map(p => p.path),
    });
  },

  // === 表单输入 ===
  onDescInput(e) { this.setData({ description: e.detail.value }); },
  onWeatherChange(e) { this.setData({ weather: WEATHERS[e.detail.value] }); },
  onGrowthStageChange(e) { this.setData({ growthStage: GROWTH_STAGES[e.detail.value] }); },
  onDateChange(e) { this.setData({ careDate: e.detail.value }); },

  // === 步骤跳转 ===
  nextToUpload() {
    if (!this.data.selectedCareType) {
      wx.showToast({ title: '请选择养护类型', icon: 'none' });
      return;
    }
    this.setData({ step: 'upload-photo' });
  },

  nextToDescribe() {
    if (!this.data.photos.length) {
      wx.showToast({ title: '请至少上传一张照片', icon: 'none' });
      return;
    }
    this.setData({ step: 'describe' });
  },

  // === 提交 ===
  async submitRecord() {
    if (this.data.submitting) return;
    if (!this.data.photos.length) {
      wx.showToast({ title: '请至少上传一张照片', icon: 'none' });
      return;
    }

    this.setData({ submitting: true, totalProgress: 0 });

    const app = getApp();
    const { selectedHerb, selectedCareType, photos, description, weather, growthStage, careDate, careTime } = this.data;
    const taskId = selectedHerb._id;

    try {
      const online = await isOnline();

      if (!online) {
        // 离线模式：暂存本地
        saveOffline({
          family_code: this.data.familyCode,
          task_id: taskId,
          herb_code: selectedHerb.herb_code,
          herb_name: selectedHerb.herb_name,
          plant_code: selectedHerb.plant_code,
          plant_name: selectedHerb.plant_name,
          plant_category: selectedHerb.plant_category,
          care_type: selectedCareType,
          photos: photos.map(p => p.path), // 本地路径
          description,
          weather,
          growth_stage: growthStage,
          care_date: careDate,
          care_time: careTime,
        });

        this.setData({ submitting: false, pendingCount: getQueueCount() });
        wx.showToast({ title: '已暂存，网络恢复后自动提交', icon: 'success' });
        this.resetForm();
        return;
      }

      // 在线模式：先压缩再上传
      this.setData({ totalProgress: 10 });

      // 1. 压缩
      const filePaths = photos.map(p => p.path);
      const compressedPaths = await compressImages(filePaths);
      this.setData({ totalProgress: 15 });

      // 2. 添加水印
      const watermarkedPaths = await addWatermarks(compressedPaths, {
        familyCode: this.data.familyCode,
        date: careDate,
      });
      this.setData({ totalProgress: 25 });

      // 3. 上传到云存储
      const uploadedUrls = [];
      for (let i = 0; i < watermarkedPaths.length; i++) {
        const filename = `${generateId()}.jpg`;
        const cloudPath = getCloudPath(this.data.familyCode, taskId, careDate, filename);
        try {
          const uploadRes = await uploadPhoto(watermarkedPaths[i], cloudPath);
          uploadedUrls.push(uploadRes.fileID);
        } catch (uploadErr) {
          console.error('上传失败，尝试重试:', uploadErr);
          if (i < 3) {
            // 重试一次
            const retryRes = await uploadPhoto(compressedPaths[i], cloudPath);
            uploadedUrls.push(retryRes.fileID);
          } else {
            throw uploadErr;
          }
        }
        this.setData({
          totalProgress: 20 + Math.floor(((i + 1) / compressedPaths.length) * 50),
        });
      }

      // 3. 调用云函数写入数据库（绕过客户端权限限制）
      this.setData({ totalProgress: 75 });
      const submitResult = await wx.cloud.callFunction({
        name: 'submitRecord',
        data: {
          family_code: this.data.familyCode,
          task_id: taskId,
          herb_code: selectedHerb.herb_code,
          herb_name: selectedHerb.herb_name,
          plant_code: selectedHerb.plant_code,
          plant_name: selectedHerb.plant_name,
          plant_category: selectedHerb.plant_category,
          care_type: selectedCareType,
          photos: uploadedUrls,
          description,
          weather,
          growth_stage: growthStage,
          care_date: careDate,
          care_time: careTime,
        },
      });

      if (!submitResult.result || !submitResult.result.success) {
        throw new Error((submitResult.result && submitResult.result.message) || '提交失败');
      }

      this.setData({ totalProgress: 100, submitting: false });
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.resetForm();

    } catch (err) {
      console.error('提交失败:', err);
      this.setData({ submitting: false });

      // 失败时也暂存
      saveOffline({
        family_code: this.data.familyCode,
        task_id: taskId,
        herb_code: selectedHerb.herb_code,
        herb_name: selectedHerb.herb_name,
        plant_code: selectedHerb.plant_code,
        plant_name: selectedHerb.plant_name,
        plant_category: selectedHerb.plant_category,
        care_type: selectedCareType,
        photos: photos.map(p => p.path),
        description,
        weather,
        growth_stage: growthStage,
        care_date: careDate,
        care_time: careTime,
      });
      this.setData({ pendingCount: getQueueCount() });
      wx.showToast({ title: '网络异常，已暂存本地', icon: 'none' });
      this.resetForm();
    }
  },

  /** 重置表单 */
  resetForm() {
    setTimeout(() => {
      this.setData({
        step: 'select-herb',
        selectedHerb: null,
        selectedCareType: '',
        selectedCareTypeLabel: '',
        photos: [],
        description: '',
        weather: '',
        growthStage: '',
        totalProgress: 0,
      });
    }, 1500);
  },

  goBack() {
    const steps = ['select-herb', 'select-type', 'upload-photo', 'describe'];
    const idx = steps.indexOf(this.data.step);
    if (idx > 0) {
      this.setData({ step: steps[idx - 1] });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/bind' });
  },
});
