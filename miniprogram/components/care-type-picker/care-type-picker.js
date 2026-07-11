const { CARE_TYPES } = require('../../utils/constants');

Component({
  properties: {
    selected: { type: String, value: '' },
  },

  data: {
    careTypes: CARE_TYPES,
  },

  methods: {
    onSelect(e) {
      const type = e.currentTarget.dataset.type;
      this.setData({ selected: type });
      this.triggerEvent('change', { value: type });
    },
  },
});
