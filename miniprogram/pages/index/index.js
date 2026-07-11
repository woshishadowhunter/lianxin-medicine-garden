Page({
  data: {
    familyCode: '',
    familyInfo: null,
    stats: [],
    calendarRecords: [],
    reminders: [],
    recentPhotos: [],
    quickActions: [
      { label: '新增养护', iconName: 'add', url: '/pages/submit/submit' },
      { label: '查看记录', iconName: 'record', url: '/pages/records/records' },
      { label: '药材档案', iconName: 'garden', url: '/pages/garden/garden' },
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
        loading: false,
      });
      return;
    }

    try {
      this.setData({ loading: true, familyCode });
      const db = wx.cloud.database();

      // 并行加载
      const [familyRes, tasksRes, recordsRes] = await Promise.all([
        db.collection('families').where({ family_code: familyCode }).get(),
        db.collection('planting_tasks').where({ family_code: familyCode }).get(),
        db.collection('care_records')
          .where({ family_code: familyCode, audit_status: 'confirmed' })
          .orderBy('care_date', 'desc')
          .limit(200)
          .get(),
      ]);

      const family = familyRes.data[0] || {
        family_code: familyCode,
        community: '社区信息待完善',
      };
      const tasks = tasksRes.data;
      const records = recordsRes.data;

      const aliveCount = tasks.filter(t => t.status === 'growing').length;
      const warningCount = tasks.filter(t => t.status === 'warning').length;

      // 统计卡片
      this.setData({
        familyInfo: family,
        stats: [
          { label: '种植种类', value: tasks.length, iconName: 'herb' },
          { label: '存活', value: aliveCount, iconName: 'check', color: 'var(--primary)' },
          { label: '需关注', value: warningCount, iconName: 'warning', tone: warningCount ? 'danger' : 'muted', color: warningCount ? 'var(--danger)' : '' },
          { label: '养护次数', value: records.length, iconName: 'record', tone: 'info', color: 'var(--info)' },
        ],
        calendarRecords: records,
        reminders: this.buildReminders(tasks, records),
        recentPhotos: this.buildRecentPhotos(records),
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
        herbName: record.herb_name,
        careType: record.care_type,
        date: record.care_date,
      })))
      .slice(0, 4);
  },

  buildReminders(tasks, records) {
    const reminders = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCareByHerb = {};
    records.forEach(r => {
      if (!lastCareByHerb[r.herb_code] || r.care_date > lastCareByHerb[r.herb_code].care_date) {
        lastCareByHerb[r.herb_code] = r;
      }
    });

    tasks.filter(t => t.status === 'growing').forEach(task => {
      const last = lastCareByHerb[task.herb_code];
      if (!last) {
        reminders.push({
          message: `${task.herb_name}：种植以来还没有养护记录，快来记录第一次养护吧`,
          urgent: true,
        });
      } else {
        const lastDate = new Date(last.care_date);
        const diffDays = Math.floor((today - lastDate) / 86400000);

        if (diffDays >= 7) {
          reminders.push({
            message: `${task.herb_name}：已 ${diffDays} 天未养护，需要关注`,
            urgent: diffDays >= 14,
          });
        } else if (diffDays >= 3) {
          reminders.push({
            message: `${task.herb_name}：上次养护是 ${diffDays} 天前，建议及时查看`,
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
