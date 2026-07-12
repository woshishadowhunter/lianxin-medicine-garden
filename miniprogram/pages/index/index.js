const { normalizePlantRecord, normalizePlantTask } = require('../../utils/plant');

Page({
  data: {
    familyCode: '',
    familyInfo: null,
    stats: [],
    calendarRecords: [],
    reminders: [],
    recentPhotos: [],
    featuredStory: null,
    pointsBalance: 0,
    quickActions: [
      { label: '记录成长', iconName: 'camera', url: '/pages/submit/submit' },
      { label: '成长记录', iconName: 'record', url: '/pages/records/records' },
      { label: '我的植物', iconName: 'garden', url: '/pages/garden/garden' },
    ],
    loading: true,
    weather: { iconName: 'weather', temp: '22°', desc: '晴天' },
  },

  onShow() {
    const familyCode = this.getActiveFamilyCode();
    if (familyCode !== this.loadedFamilyCode || !this.data.familyInfo) {
      this.loadDashboard();
    }
  },

  onPullDownRefresh() {
    this.loadDashboard().then(() => wx.stopPullDownRefresh());
  },

  getActiveFamilyCode() {
    const app = getApp();
    const storedCode = wx.getStorageSync('familyCode');
    const familyCode = String(app.globalData.familyCode || storedCode || '').trim().toUpperCase();
    if (familyCode && app.globalData.familyCode !== familyCode) {
      app.globalData.familyCode = familyCode;
      wx.setStorageSync('familyCode', familyCode);
    }
    return familyCode;
  },

  async loadDashboard() {
    const familyCode = this.getActiveFamilyCode();
    if (!familyCode) {
      this.loadedFamilyCode = '';
      this.setData({
        familyCode: '',
        familyInfo: null,
        stats: [],
        calendarRecords: [],
        reminders: [],
        recentPhotos: [],
        featuredStory: null,
        pointsBalance: 0,
        loading: false,
      });
      return;
    }

    try {
      this.setData({ loading: true, familyCode });
      const db = wx.cloud.database();

      // 并行加载
      const [familyRes, tasksRes, recordsRes, pointsRes] = await Promise.all([
        db.collection('families').where({ family_code: familyCode }).get(),
        db.collection('planting_tasks').where({ family_code: familyCode }).get(),
        db.collection('care_records')
          .where({ family_code: familyCode, audit_status: 'confirmed' })
          .orderBy('care_date', 'desc')
          .limit(200)
          .get(),
        wx.cloud.callFunction({ name: 'pointsBank', data: { action: 'getAccount', familyCode } })
          .catch(() => ({ result: { success: false } })),
      ]);

      const family = familyRes.data[0] || {
        family_code: familyCode,
        community: '社区信息待完善',
      };
      const tasks = tasksRes.data.map(normalizePlantTask);
      const records = recordsRes.data.map(normalizePlantRecord);
      const recentPhotos = this.buildRecentPhotos(records);

      const aliveCount = tasks.filter(t => t.status === 'growing').length;
      const warningCount = tasks.filter(t => t.status === 'warning').length;

      // 统计卡片
      this.setData({
        familyInfo: family,
        stats: [
          { label: '我的植物', value: tasks.length, iconName: 'garden' },
          { label: '存活', value: aliveCount, iconName: 'check', color: 'var(--primary)' },
          { label: '需关注', value: warningCount, iconName: 'warning', tone: warningCount ? 'danger' : 'muted', color: warningCount ? 'var(--danger)' : '' },
          { label: '养护次数', value: records.length, iconName: 'record', tone: 'info', color: 'var(--info)' },
        ],
        calendarRecords: records,
        reminders: this.buildReminders(tasks, records),
        recentPhotos,
        featuredStory: recentPhotos[0] || null,
        pointsBalance: pointsRes.result && pointsRes.result.success ? pointsRes.result.data.balance : 0,
        loading: false,
      });
      this.loadedFamilyCode = familyCode;
    } catch (err) {
      console.error('加载首页失败:', err);
      this.loadedFamilyCode = familyCode;
      this.setData({
        familyCode,
        familyInfo: {
          family_code: familyCode,
          community: '数据暂未加载',
        },
        stats: [],
        calendarRecords: [],
        reminders: [],
        recentPhotos: [],
        loading: false,
      });
    }
  },

  buildRecentPhotos(records) {
    return records
      .flatMap(record => (record.photos || []).map(photo => ({
        photo,
        id: record._id,
        plantName: record.plant_name,
        careType: record.care_type,
        date: record.care_date,
        description: record.description || '记录了一次新的成长变化',
      })))
      .slice(0, 4);
  },

  buildReminders(tasks, records) {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCareByPlant = {};
    records.forEach(r => {
      if (!lastCareByPlant[r.plant_code] || r.care_date > lastCareByPlant[r.plant_code].care_date) {
        lastCareByPlant[r.plant_code] = r;
      }
    });

    tasks.filter(t => t.status === 'growing').forEach(task => {
      const last = lastCareByPlant[task.plant_code];
      if (!last) {
        reminders.push({
          message: `${task.plant_name}：还没有成长记录，拍下它现在的样子吧`,
          urgent: true,
        });
      } else {
        const lastDate = new Date(last.care_date);
        const diffDays = Math.floor((today - lastDate) / 86400000);

        if (diffDays >= 7) {
          reminders.push({
            message: `${task.plant_name}：已 ${diffDays} 天没有记录，需要关注`,
            urgent: diffDays >= 14,
          });
        } else if (diffDays >= 3) {
          reminders.push({
            message: `${task.plant_name}：上次记录是 ${diffDays} 天前，建议及时查看`,
            urgent: false,
          });
        }
      }
    });

    return reminders.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
  },

  navigateTo(e) {
    const url = e.currentTarget.dataset.url;
    const tabPages = ['/pages/index/index', '/pages/records/records', '/pages/submit/submit', '/pages/garden/garden', '/pages/profile/profile'];
    if (tabPages.includes(url)) {
      wx.switchTab({ url });
    } else if (url.startsWith('/pages/')) {
      wx.navigateTo({ url });
    }
  },

  goBind() {
    wx.navigateTo({ url: '/pages/bind/bind' });
  },

  onAdminEntry() {
    const app = getApp();
    if (app.globalData.isAdmin) {
      wx.navigateTo({ url: '/pages/admin/dashboard/dashboard' });
    }
  },
});
