/**
 * 养护日历热力图组件
 * 展示过去12周的养护频率
 */
const { formatDate } = require('../../utils/date');

Component({
  properties: {
    records: { type: Array, value: [] },
    weeks: { type: Number, value: 12 },
  },

  data: {
    grid: [],
    dayLabels: ['一','二','三','四','五','六','日'],
    monthLabels: [],
    maxCount: 0,
  },

  observers: {
    'records'(records) {
      this.buildHeatmap(records);
    },
  },

  methods: {
    buildHeatmap(records) {
      // 构建日期 -> 养护次数 映射
      const dateCount = {};
      records.forEach(r => {
        const d = r.care_date || formatDate(r.created_at);
        dateCount[d] = (dateCount[d] || 0) + 1;
      });

      const maxCount = Math.max(...Object.values(dateCount), 1);
      const today = new Date();
      const grid = [];
      const monthLabels = [];

      // 生成12周 x 7天的网格
      for (let w = this.properties.weeks - 1; w >= 0; w--) {
        const week = [];
        for (let d = 0; d < 7; d++) {
          const dayOffset = w * 7 + d;
          const date = new Date(today);
          date.setDate(date.getDate() - (this.properties.weeks * 7 - 1 - dayOffset));
          const dateStr = formatDate(date);
          const count = dateCount[dateStr] || 0;
          week.push({ date: dateStr, count, level: this.getLevel(count, maxCount) });
        }
        grid.push(week);

        // 每月第一天标记月份
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() - (w * 7));
        if (firstDayOfWeek.getDate() <= 7) {
          monthLabels.push({
            week: this.properties.weeks - 1 - w,
            label: `${firstDayOfWeek.getMonth() + 1}月`,
          });
        }
      }

      this.setData({ grid, monthLabels, maxCount });
    },

    getLevel(count, max) {
      if (count === 0) return 0;
      if (count <= max * 0.25) return 1;
      if (count <= max * 0.5) return 2;
      if (count <= max * 0.75) return 3;
      return 4;
    },
  },
});
