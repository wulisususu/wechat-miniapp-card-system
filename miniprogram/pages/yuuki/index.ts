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
    actionLoading: '',
    stats: { total: 0, available: 0, issued: 0, discarded: 0 },
    items: [] as YuukiAccount[],
    statusOptions: STATUS_OPTIONS,
    status: 'all',
    keyword: '',
    page: 1,
    pageSize: 50,
    total: 0,
    hasMore: false,
    registerCounts: [1, 2, 3],
    registerCount: 3,
    lastIssued: null as YuukiAccount | null
  },

  onLoad() {
    this.refreshAll();
  },

  onShow() {
    if (this.data.items.length) this.refreshAll(false);
  },

  onPullDownRefresh() {
    this.refreshAll(false).finally(() => wx.stopPullDownRefresh());
  },

  async refreshAll(showLoading = true) {
    if (showLoading) this.setData({ loading: true });
    try {
      await Promise.all([this.loadStats(), this.loadList(1)]);
    } catch (err) {
      this.showError(err);
    } finally {
      if (showLoading) this.setData({ loading: false });
    }
  },

  async loadStats() {
    const res = await yuukiApi.stats();
    const s = res.stats || res || {};
    const available = Number(s.available || 0);
    const issued = Number(s.issued || 0);
    const discarded = Number(s.discarded || 0);
    this.setData({ stats: { total: available + issued + discarded, available, issued, discarded } });
  },

  async loadList(page = 1) {
    const res = await yuukiApi.list(this.data.status, this.data.keyword.trim(), page, this.data.pageSize);
    const items = (res.items || []) as YuukiAccount[];
    const total = Number(res.total || items.length);
    this.setData({ items, total, page, hasMore: page * this.data.pageSize < total });
  },

  onKeywordInput(e: any) {
    this.setData({ keyword: e.detail.value || '' });
  },

  onSearch() {
    this.runListAction(() => this.loadList(1));
  },

  clearSearch() {
    this.setData({ keyword: '' }, () => this.runListAction(() => this.loadList(1)));
  },

  changeStatus(e: any) {
    const status = e.currentTarget.dataset.status as string;
    if (!status || status === this.data.status) return;
    this.setData({ status }, () => this.runListAction(() => this.loadList(1)));
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
      if (res.limited) {
        wx.showModal({ title: '注册限速', content: `本次成功 ${registered} 个，请约 ${res.wait_seconds || 0} 秒后再试。`, showCancel: false });
      } else {
        wx.showToast({ title: `成功 ${registered} 个${failed ? `，失败 ${failed}` : ''}`, icon: registered ? 'success' : 'none' });
      }
      await this.refreshAll(false);
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
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
      wx.showModal({ title: '已取号并复制', content: `账号：${account.username}\n密码：${account.password}`, showCancel: false });
      await this.refreshAll(false);
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
      content: `仅做废弃标记。确认废弃 ${username}？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) this.accountAction(`discard:${username}`, () => yuukiApi.discard(username), '已标记废弃');
      }
    });
  },

  allowLogin(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    const typ = e.currentTarget.dataset.typ as 'all' | 'ip_add';
    const label = typ === 'all' ? '允许所有 IP' : '允许服务器当前 IP';
    wx.showModal({
      title: label,
      content: `账号 ${username}\n登录令牌约 5 分钟有效。`,
      success: (res) => {
        if (res.confirm) this.accountAction(`allow:${username}:${typ}`, () => yuukiApi.allowLogin(username, typ), '允许登录成功', true);
      }
    });
  },

  async accountAction(key: string, action: () => Promise<any>, successText: string, showIp = false) {
    if (this.data.actionLoading) return;
    this.setData({ actionLoading: key });
    try {
      const res = await action();
      if (res && res.ok === false) throw new Error(res.error || '操作失败');
      const ipText = showIp && res && Array.isArray(res.iplock) && res.iplock.length ? `\nIP：${res.iplock.join(', ')}` : '';
      if (ipText) wx.showModal({ title: successText, content: `${successText}${ipText}`, showCancel: false });
      else wx.showToast({ title: successText, icon: 'success' });
      await this.refreshAll(false);
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
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
