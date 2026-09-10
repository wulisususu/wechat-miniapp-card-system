Component({
  properties: {
    current: { type: String, value: 'activation' },
    title: { type: String, value: '激活码服务' }
  },
  data: {
    open: false,
    statusBarHeight: 20
  },
  lifetimes: {
    attached() {
      try {
        const info = wx.getSystemInfoSync();
        this.setData({ statusBarHeight: info.statusBarHeight || 20 });
      } catch (_err) {
        this.setData({ statusBarHeight: 20 });
      }
    }
  },
  methods: {
    toggle() {
      this.setData({ open: !this.data.open });
    },
    close() {
      if (this.data.open) this.setData({ open: false });
    },
    noop() {},
    switchBusiness(e: any) {
      const target = e.currentTarget.dataset.target as string;
      if (!target || target === this.data.current) {
        this.close();
        return;
      }
      this.setData({ open: false }, () => {
        wx.redirectTo({ url: target === 'yuuki' ? '/pages/yuuki/index' : '/pages/chat/index' });
      });
    }
  }
});
