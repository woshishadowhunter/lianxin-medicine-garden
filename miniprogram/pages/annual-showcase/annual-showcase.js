const { PRESET_PLANTS, CARE_TYPES } = require('../../utils/constants');
const { normalizePlantTask } = require('../../utils/plant');

Page({
  data: {
    loading: true,
    familyCode: '',
    community: '',
    stats: { totalRecords: 0, totalPhotos: 0, herbCount: 0, score: 0 },
    monthlyTrend: null,
    careTypeDist: null,
    herbs: [],
    calendarData: [],
    firstPhotos: [],
    latestPhotos: [],
    badges: [],
    isAnnualComplete: false,
  },

  onLoad() {
    const app = getApp();
    this.setData({ familyCode: app.globalData.familyCode });
    this.loadShowcase();
  },

  async loadShowcase() {
    const { familyCode } = this.data;
    if (!familyCode) { this.setData({ loading: false }); return; }

    try {
      const db = wx.cloud.database();

      // 并行加载所有数据
      const [tasksRes, recordsRes, familyRes] = await Promise.all([
        db.collection('planting_tasks').where({ family_code: familyCode }).get(),
        db.collection('care_records')
          .where({ family_code: familyCode, audit_status: 'confirmed' })
          .orderBy('care_date', 'asc')
          .limit(500)
          .get(),
        db.collection('families').where({ family_code: familyCode }).get(),
      ]);

      const tasks = tasksRes.data.map(normalizePlantTask);
      const records = recordsRes.data;
      const family = familyRes.data[0] || {};

      if (!records.length) {
        this.setData({ loading: false });
        return;
      }

      // === 基础统计 ===
      const totalPhotos = records.reduce((sum, r) => sum + (r.photos ? r.photos.length : 0), 0);
      const score = this.calculateDiligenceScore(records, tasks);

      this.setData({
        community: family.community || '',
        stats: {
          totalRecords: records.length,
          totalPhotos,
          herbCount: tasks.length,
          score,
        },
      });

      // === 月度趋势 ===
      const monthlyCounts = {};
      records.forEach(r => {
        const month = r.care_date.slice(0, 7); // YYYY-MM
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      });
      const months = Object.keys(monthlyCounts).sort();
      this.setData({
        monthlyTrend: {
          labels: months.map(m => m.slice(5)),
          series: [{ name: '养护次数', data: months.map(m => monthlyCounts[m]), color: '#1f6b4b' }],
        },
      });

      // === 养护类型分布 ===
      const typeCounts = {};
      records.forEach(r => { typeCounts[r.care_type] = (typeCounts[r.care_type] || 0) + 1; });
      const typeLabels = [], typeData = [];
      CARE_TYPES.forEach(ct => {
        if (typeCounts[ct.value]) {
          typeLabels.push(ct.label);
          typeData.push(typeCounts[ct.value]);
        }
      });
      this.setData({ careTypeDist: { labels: typeLabels, data: typeData } });

      // === 每株植物统计 ===
      const herbs = tasks.map(task => {
        const plantConfig = PRESET_PLANTS.find(plant => plant.code === task.plant_code) || {};
        const herbRecords = records.filter(r => r.task_id === task._id);
        const allPhotos = herbRecords.flatMap(r => (r.photos || []));
        const careTypeStats = {};
        herbRecords.forEach(r => { careTypeStats[r.care_type] = (careTypeStats[r.care_type] || 0) + 1; });

        return {
          name: task.plant_name,
          iconName: task.plant_icon_name || plantConfig.iconName || 'garden',
          status: task.status,
          recordCount: herbRecords.length,
          photoCount: allPhotos.length,
          firstCare: herbRecords[0] ? herbRecords[0].care_date : null,
          lastCare: herbRecords.length ? herbRecords[herbRecords.length - 1].care_date : null,
          firstPhoto: allPhotos[0] || null,
          latestPhoto: allPhotos[allPhotos.length - 1] || null,
          careTypeStats,
        };
      });
      this.setData({ herbs });

      // === 首尾对比照片 ===
      this.setData({
        firstPhotos: herbs.map(h => ({ herb: h.name, iconName: h.iconName, url: h.firstPhoto })).filter(h => h.url),
        latestPhotos: herbs.map(h => ({ herb: h.name, iconName: h.iconName, url: h.latestPhoto })).filter(h => h.url),
      });

      // === 成就徽章 ===
      const badges = [];
      if (score >= 90) badges.push({ iconName: 'trophy', label: '养护标兵', desc: '养护勤奋度超过90分' });
      if (records.length >= 100) badges.push({ iconName: 'medal', label: '百次养护', desc: '累计养护超过100次' });
      if (tasks.length >= 4) badges.push({ iconName: 'garden', label: '植物达人', desc: '持续记录4株以上植物' });
      if (totalPhotos >= 50) badges.push({ iconName: 'camera', label: '记录大师', desc: '拍摄超过50张养护照片' });
      records.forEach(r => {
        if (r.care_type === 'growth_check' && !badges.find(b => b.iconName === 'search')) {
          badges.push({ iconName: 'search', label: '细心观察者', desc: '进行了生长确认记录' });
        }
      });
      this.setData({ badges: badges.slice(0, 6) });

      // === 年度日历 ===
      const calendarCounts = {};
      records.forEach(r => { calendarCounts[r.care_date] = (calendarCounts[r.care_date] || 0) + 1; });
      this.setData({ calendarData: records });

      // 检查年度是否完成
      this.setData({
        isAnnualComplete: records.length > 0,
        loading: false,
      });

    } catch (err) {
      console.error('加载年度展示失败:', err);
      this.setData({ loading: false });
    }
  },

  /** 养护勤奋度评分 (0-100) */
  calculateDiligenceScore(records, tasks) {
    if (!records.length) return 0;

    // 基础分：有记录就有40分
    let score = 40;

    // 记录密度分：平均每周至少1次 +30分
    const firstDate = new Date(records[0].care_date);
    const lastDate = new Date(records[records.length - 1].care_date);
    const totalWeeks = Math.max(1, Math.ceil((lastDate - firstDate) / (7 * 86400000)));
    const avgPerWeek = records.length / totalWeeks;
    score += Math.min(30, Math.round(avgPerWeek * 10));

    // 照片质量分：有照片的记录比例
    const withPhotos = records.filter(r => r.photos && r.photos.length > 0).length;
    score += Math.round((withPhotos / records.length) * 15);

    // 覆盖度分：每株植物都有养护记录
    const herbCoverage = tasks.filter(t => {
      const taskRecords = records.filter(r => r.task_id === t._id);
      return taskRecords.length > 0;
    }).length;
    score += Math.round((herbCoverage / tasks.length) * 15);

    return Math.min(100, score);
  },

  /** 检查是否已到年度结束 */
  checkAnnualComplete(lastRecord) {
    // 年度从谷雨(4/20)开始，到年底
    const now = new Date();
    const isComplete = now.getFullYear() > 2026 || (now.getMonth() >= 11 && now.getDate() >= 31);
    this.setData({ isAnnualComplete: isComplete || this.data.records.length >= 10 });
  },

  /** 预览对比照片 */
  previewCompare(e) {
    const { before, after } = e.currentTarget.dataset;
    wx.previewImage({
      urls: [before, after].filter(Boolean),
    });
  },
});
