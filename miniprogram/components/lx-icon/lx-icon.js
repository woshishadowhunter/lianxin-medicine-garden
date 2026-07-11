const VALID_TONES = ['brand', 'ink', 'muted', 'accent', 'warning', 'danger', 'info', 'white'];

Component({
  properties: {
    name: { type: String, value: 'herb' },
    tone: { type: String, value: 'brand' },
    size: { type: Number, value: 40 },
    className: { type: String, value: '' },
  },

  data: {
    src: '',
  },

  lifetimes: {
    attached() {
      this.updateSrc();
    },
  },

  observers: {
    'name, tone'(name, tone) {
      this.updateSrc(name, tone);
    },
  },

  methods: {
    updateSrc(name = this.properties.name, tone = this.properties.tone) {
      const safeTone = VALID_TONES.includes(tone) ? tone : 'brand';
      const safeName = name || 'herb';
      this.setData({ src: `/images/ui-icons/${safeTone}/${safeName}.png` });
    },
  },
});
