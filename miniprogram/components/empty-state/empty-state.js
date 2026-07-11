Component({
  properties: {
    iconName: { type: String, value: 'archive' },
    icon: { type: String, value: '' },
    text: { type: String, value: '暂无数据' },
    showButton: { type: Boolean, value: false },
    buttonText: { type: String, value: '' },
  },

  methods: {
    onAction() {
      this.triggerEvent('action');
    },
  },
});
