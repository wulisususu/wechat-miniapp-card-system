import { yuukiApi, YuukiAccount } from '../../services/yuuki';

const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'available', label: '可用' },
  { value: 'issued', label: '已发出' },
  { value: 'discarded', label: '已废弃' }
];

Page({
  data: {
    loading: false,
    advancedLoading: false,
    actionLoading: '',
    registerCounts: [1, 2, 3],
    registerCount: 1,
    createdAccounts: [] as YuukiAccount[],
    quickLoginUsername: '',
    keyword: '',
    items: [] as YuukiAccount[],
    total: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    listActivated: false,
    listTitle: '搜索结果',
    statusOptions: STATUS_OPTIONS,
    status: 'all',
    showAdvanced: false,
    statsLoaded: false,
    stats: { total: 0, available: 0, issued: 0, discarded: 0 },
    lastIssued: null as YuukiAccount | null
  },

  onPullDownRefresh() {
    this.refreshVisible().finally(() => wx.stopPullDownRefresh());
  },

  async refreshVisible() {
    const tasks: Promise<any>[] = [];
    if (this.data.statsLoaded) tasks.push(this.loadStats());
    if (this.data.listActivated) tasks.push(this.loadList(1));
    if (!tasks.length) return;
    try {
      await Promise.all(tasks);
    } catch (err) {
      this.showError(err);
    }
  },

  setRegisterCount(e: any) {
    const count = Number(e.currentTarget.dataset.count || 1);
    this.setData({ registerCount: Math.min(3, Math.max(1, count)) });
  },

  async registerAccounts() {
    if (this.data.actionLoading) return;
    this.setData({ actionLoading: 'register' });
    try {
      const res = await yuukiApi.register(this.data.registerCount);
      const registered = Number(res.registered || 0);
      const failed = Number(res.failed || 0);
      const createdAccounts = (res.items || []) as YuukiAccount[];
      this.setData({ createdAccounts });

      if (res.limited) {
        wx.showModal({
          title: '注册限速',
          content: `本次成功 ${registered} 个，请约 ${res.wait_seconds || 0} 秒后再试。`,
          showCancel: false
        });
      } else {
        wx.showToast({
          title: registered ? `已创建 ${registered} 个` : `创建失败${failed ? ` ${failed} 个` : ''}`,
          icon: registered ? 'success' : 'none'
        });
      }

      if (this.data.statsLoaded) await this.loadStats();
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
  },

  onQuickLoginInput(e: any) {
    this.setData({ quickLoginUsername: e.detail.value || '' });
  },

  quickAllowLogin(e: any) {
    const username = this.data.quickLoginUsername.trim();
    const typ = e.currentTarget.dataset.typ as 'all' | 'ip_add';
    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' });
      return;
    }
    this.executeAllowLogin(username, typ);
  },

  onKeywordInput(e: any) {
    this.setData({ keyword: e.detail.value || '' });
  },

  onSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      wx.showToast({ title: '请输入要搜索的账号', icon: 'none' });
      return;
    }
    this.setData({ status: 'all', listActivated: true, listTitle: '搜索结果' }, () => {
      this.runListAction(() => this.loadList(1));
    });
  },

  clearSearch() {
    this.setData({
      keyword: '',
      items: [],
      total: 0,
      page: 1,
      hasMore: false,
      listActivated: false,
      listTitle: '搜索结果',
      status: 'all'
    });
  },

  async loadList(page = 1, append = false) {
    const res = await yuukiApi.list(this.data.status, this.data.keyword.trim(), page, this.data.pageSize);
    const incoming = (res.items || []) as YuukiAccount[];
    const items = append ? this.data.items.concat(incoming) : incoming;
    const total = Number(res.total || items.length);
    this.setData({
      items,
      total,
      page,
      hasMore: page * this.data.pageSize < total,
      listActivated: true
    });
  },

  loadMore() {
    if (this.data.loading || !this.data.hasMore) return;
    this.runListAction(() => this.loadList(this.data.page + 1, true));
  },

  toggleAdvanced() {
    const showAdvanced = !this.data.showAdvanced;
    this.setData({ showAdvanced });
    if (showAdvanced && !this.data.statsLoaded) {
      this.setData({ advancedLoading: true });
      this.loadStats()
        .catch((err) => this.showError(err))
        .finally(() => this.setData({ advancedLoading: false }));
    }
  },

  async loadStats() {
    const res = await yuukiApi.stats();
    const s = res.stats || res || {};
    const available = Number(s.available || 0);
    const issued = Number(s.issued || 0);
    const discarded = Number(s.discarded || 0);
    this.setData({
      statsLoaded: true,
      stats: {
        total: available + issued + discarded,
        available,
        issued,
        discarded
      }
    });
  },

  changeStatus(e: any) {
    const status = String(e.currentTarget.dataset.status || 'all');
    const option = STATUS_OPTIONS.find((item) => item.value === status);
    this.setData({
      status,
      keyword: '',
      listActivated: true,
      listTitle: option ? `${option.label}账号` : '账号浏览'
    }, () => this.runListAction(() => this.loadList(1)));
  },

  async takeNext() {
    if (this.data.actionLoading) return;
    this.setData({ actionLoading: 'next' });
    try {
      const res = await yuukiApi.next('miniapp');
      if (res.empty || !res.account) {
        wx.showToast({ title: '暂无可用账号', icon: 'none' });
        return;
      }
      const account = res.account as YuukiAccount;
      this.setData({ lastIssued: account });
      wx.setClipboardData({ data: `${account.username}\n${account.password}` });
      wx.showModal({
        title: '已取号并复制',
        content: `账号：${account.username}\n密码：${account.password}`,
        showCancel: false
      });
      await this.refreshAfterAction();
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
  },

  copyAccount(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    const password = String(e.currentTarget.dataset.password || '');
    wx.setClipboardData({ data: `${username}\n${password}` });
  },

  allowLogin(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    const typ = e.currentTarget.dataset.typ as 'all' | 'ip_add';
    this.executeAllowLogin(username, typ);
  },

  executeAllowLogin(username: string, typ: 'all' | 'ip_add') {
    if (!username || this.data.actionLoading) return;
    const successText = typ === 'all' ? '已允许登录' : '已允许服务器 IP';
    this.accountAction(
      `allow:${username}:${typ}`,
      () => yuukiApi.allowLogin(username, typ),
      successText,
      true
    );
  },

  releaseAccount(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    wx.showModal({
      title: '释放回池',
      content: `确认将 ${username} 重新标记为可用？`,
      success: (res) => {
        if (res.confirm) this.accountAction(`release:${username}`, () => yuukiApi.release(username), '已回池');
      }
    });
  },

  discardAccount(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    wx.showModal({
      title: '废弃账号',
      content: `确认将 ${username} 标记为废弃？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) this.accountAction(`discard:${username}`, () => yuukiApi.discard(username), '已标记废弃');
      }
    });
  },

  async accountAction(key: string, action: () => Promise<any>, successText: string, showIp = false) {
    if (this.data.actionLoading) return;
    this.setData({ actionLoading: key });
    try {
      const res = await action();
      if (res && res.ok === false) throw new Error(res.error || '操作失败');

      const ipText = showIp && res && Array.isArray(res.iplock) && res.iplock.length
        ? `\nIP：${res.iplock.join(', ')}`
        : '';

      if (ipText) {
        wx.showModal({ title: successText, content: `${successText}${ipText}`, showCancel: false });
      } else {
        wx.showToast({ title: successText, icon: 'success' });
      }
      await this.refreshAfterAction();
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
  },

  async refreshAfterAction() {
    const tasks: Promise<any>[] = [];
    if (this.data.statsLoaded) tasks.push(this.loadStats());
    if (this.data.listActivated) tasks.push(this.loadList(1));
    if (tasks.length) await Promise.all(tasks);
  },

  async runListAction(action: () => Promise<void>) {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      await action();
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ loading: false });
    }
  },

  showError(err: any) {
    const message = err && err.message ? err.message : '请求失败';
    wx.showToast({ title: String(message).slice(0, 28), icon: 'none', duration: 2500 });
  }
});
