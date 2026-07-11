/**
 * 轻量级 Canvas 图表组件
 * 支持：bar（柱状图）、pie（饼图）、hbar（横向柱状图）
 *
 * 使用方式：
 *   <chart type="bar" data="{{chartData}}" width="670" height="400" />
 *
 * chartData 格式：
 *   bar/hbar: { labels: ['A','B'], series: [{ name: '', data: [1,2], color: '#1f6b4b' }] }
 *   pie: { labels: ['A','B'], data: [30, 70], colors: ['#1f6b4b','#b98b45'] }
 */

Component({
  properties: {
    type: { type: String, value: 'bar' },
    data: { type: Object, value: null },
    width: { type: Number, value: 670 },
    height: { type: Number, value: 400 },
    title: { type: String, value: '' },
  },

  data: {
    canvasId: '',
    dpr: 1,
  },

  lifetimes: {
    attached() {
      this.setData({ canvasId: `chart_${Math.random().toString(36).substr(2, 8)}` });
      this.initCanvas();
    },
  },

  observers: {
    'data, type'(data, type) {
      if (data && type && this._ready) {
        this.drawChart();
      }
    },
  },

  methods: {
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#chartCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return setTimeout(() => this.initCanvas(), 100);
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getWindowInfo().pixelRatio;
          canvas.width = this.properties.width * dpr;
          canvas.height = this.properties.height * dpr;
          ctx.scale(dpr, dpr);
          this._ctx = ctx;
          this._ready = true;
          this.setData({ dpr });
          if (this.properties.data) this.drawChart();
        });
    },

    drawChart() {
      if (!this._ctx) return;
      const { type } = this.properties;
      this._ctx.clearRect(0, 0, this.properties.width, this.properties.height);
      if (type === 'bar') this.drawBar();
      else if (type === 'hbar') this.drawHBar();
      else if (type === 'pie') this.drawPie();
    },

    // ============ 柱状图 ============
    drawBar() {
      const ctx = this._ctx;
      const { data, width, height, title } = this.properties;
      if (!data || !data.labels) return;
      const W = width, H = height;
      const pad = { top: title ? 48 : 20, right: 20, bottom: 50, left: 60 };
      const chartW = W - pad.left - pad.right;
      const chartH = H - pad.top - pad.bottom;

      const series = data.series || [];
      const allValues = series.flatMap(s => s.data);
      const maxVal = Math.max(...allValues, 1);
      const ySteps = this.niceSteps(maxVal, 5);

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      // 标题
      if (title) {
        ctx.fillStyle = '#1c2a22';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, W / 2, 32);
      }

      // Y轴网格线和标签
      ctx.fillStyle = '#95a096';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ySteps.forEach((val, i) => {
        const y = pad.top + chartH - (val / ySteps[ySteps.length - 1]) * chartH;
        ctx.beginPath();
        ctx.strokeStyle = '#edf1eb';
        ctx.setLineDash([4, 4]);
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(String(val), pad.left - 8, y + 4);
      });

      // X轴标签
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5d6b61';
      const barGroupWidth = chartW / data.labels.length;
      data.labels.forEach((label, i) => {
        const x = pad.left + barGroupWidth * i + barGroupWidth / 2;
        ctx.fillText(label, x, H - pad.bottom + 24);
      });

      // 柱状条
      const barGap = 4;
      const barsPerGroup = series.length;
      const totalBarGap = (barsPerGroup - 1) * barGap;
      const barWidth = (barGroupWidth - 20 - totalBarGap) / barsPerGroup;

      series.forEach((s, si) => {
        ctx.fillStyle = s.color || this.colorFor(si);
        s.data.forEach((val, i) => {
          const barH = (val / ySteps[ySteps.length - 1]) * chartH;
          const x = pad.left + barGroupWidth * i + 10 + si * (barWidth + barGap);
          const y = pad.top + chartH - barH;
          this.roundRect(ctx, x, y, barWidth, barH, 4);
          ctx.fill();

          // 数值标签
          if (val > 0) {
            ctx.fillStyle = '#1c2a22';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(val), x + barWidth / 2, y - 6);
            ctx.fillStyle = s.color || this.colorFor(si);
          }
        });
      });
    },

    // ============ 横向柱状图 ============
    drawHBar() {
      const ctx = this._ctx;
      const { data, width, height, title } = this.properties;
      if (!data || !data.labels) return;
      const W = width, H = height;
      const pad = { top: title ? 48 : 10, right: 50, bottom: 10, left: 100 };
      const chartH = H - pad.top - pad.bottom;

      const values = data.series ? data.series[0].data : data.data || [];
      const maxVal = Math.max(...values, 1);
      const barHeight = Math.min(36, chartH / data.labels.length - 6);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = '#1c2a22';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, W / 2, 32);
      }

      const colors = data.colors || ['#1f6b4b', '#4f9468', '#cde1d2',
        '#b98b45', '#3d739c', '#c95045', '#7d6aa8', '#4d9a9a'];

      data.labels.forEach((label, i) => {
        const y = pad.top + i * (barHeight + 6);
        const val = values[i] || 0;
        const barW = (val / maxVal) * (W - pad.left - pad.right);

        // 标签
        ctx.fillStyle = '#1c2a22';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(label, pad.left - 8, y + barHeight / 2 + 4);

        // 条
        ctx.fillStyle = colors[i % colors.length];
        this.roundRect(ctx, pad.left, y, Math.max(barW, 4), barHeight, 6);
        ctx.fill();

        // 值
        ctx.fillStyle = '#1c2a22';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(val), pad.left + Math.max(barW, 4) + 6, y + barHeight / 2 + 4);
      });
    },

    // ============ 饼图 ============
    drawPie() {
      const ctx = this._ctx;
      const { data, width, height, title } = this.properties;
      if (!data || !data.data) return;
      const W = width, H = height;
      const cx = W / 2;
      const cy = title ? H / 2 + 10 : H / 2;
      const outerR = Math.min(W, H) / 2 - 30;
      const innerR = outerR * 0.55; // 0 for full pie, >0 for donut

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);

      if (title) {
        ctx.fillStyle = '#1c2a22';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, W / 2, 32);
      }

      const values = data.data || [];
      const total = values.reduce((a, b) => a + b, 0);
      if (total === 0) return;

      const colors = data.colors || ['#1f6b4b','#b98b45','#3d739c','#c95045',
        '#7d6aa8','#4d9a9a','#d8922f','#8d6a4a','#6f7f73','#b55f76','#8fbea1'];
      let startAngle = -Math.PI / 2;

      // 扇形
      values.forEach((val, i) => {
        const sliceAngle = (val / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx + innerR * Math.cos(startAngle), cy + innerR * Math.sin(startAngle));
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();

        // 标签线
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = outerR + 16;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);
        ctx.beginPath();
        ctx.moveTo(cx + outerR * Math.cos(midAngle), cy + outerR * Math.sin(midAngle));
        ctx.lineTo(lx, ly);
        ctx.lineTo(lx + (lx > cx ? 30 : -30), ly);
        ctx.strokeStyle = '#dce5dc';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 标签
        ctx.fillStyle = '#1c2a22';
        ctx.font = '11px sans-serif';
        ctx.textAlign = lx > cx ? 'left' : 'right';
        const pct = ((val / total) * 100).toFixed(1);
        ctx.fillText(`${data.labels[i] || ''} ${pct}%`, lx + (lx > cx ? 32 : -32), ly + 4);

        startAngle += sliceAngle;
      });

      // 中心文字
      ctx.fillStyle = '#1c2a22';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(total), cx, cy - 4);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#5d6b61';
      ctx.fillText('总计', cx, cy + 16);
    },

    // ============ 工具方法 ============
    niceSteps(max, count) {
      const raw = max / count;
      const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
      const residual = raw / magnitude;
      let tick;
      if (residual <= 1.5) tick = 1 * magnitude;
      else if (residual <= 3) tick = 2 * magnitude;
      else if (residual <= 7) tick = 5 * magnitude;
      else tick = 10 * magnitude;

      const steps = [];
      for (let i = 0; i <= count; i++) {
        const val = Math.round(i * tick);
        if (val <= max) steps.push(val);
      }
      if (!steps.includes(max) && steps.length) steps.push(Math.ceil(max / tick) * tick);
      return steps;
    },

    colorFor(i) {
      const palette = ['#1f6b4b','#b98b45','#3d739c','#c95045',
        '#7d6aa8','#4d9a9a','#d8922f','#8d6a4a'];
      return palette[i % palette.length];
    },

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
      ctx.lineTo(x + w, y + h - r);
      ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
      ctx.lineTo(x + r, y + h);
      ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
      ctx.lineTo(x, y + r);
      ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
      ctx.closePath();
    },
  },
});
