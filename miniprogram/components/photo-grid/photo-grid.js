Component({
  properties: {
    photos: { type: Array, value: [] },
    columns: { type: Number, value: 3 },
    showEmpty: { type: Boolean, value: true },
  },

  methods: {
    preview(e) {
      const { index } = e.currentTarget.dataset;
      wx.previewImage({
        current: this.properties.photos[index],
        urls: this.properties.photos,
      });
    },
  },
});
