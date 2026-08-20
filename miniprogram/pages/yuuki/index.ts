import { yuukiApi, YuukiAccount, GrantCandidate } from '../../services/yuuki';

const RECENT_COUNT = 10;

Page({
  data: {
    loading: false,
    actionLoading: '',
    registerCountOptions: ['1', '2', '3', '5', '10', '20'],
    registerCountIndex: 0,
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
    recentAccounts: [] as YuukiAccount[],
    showActionPopup: false,
    actionAccount: null as YuukiAccount | null,
    showIpInput: false,
    ipSegments: ['', '', '', ''] as string[],
    ipFocusIndex: 0,
    // UID/服务器 选择与手动输入
    showUidPicker: false,
    showUidManual: false,
    candidates: [] as GrantCandidate[],
    candidateLabels: [] as string[],
    candidateIndex: 0,
    uidInput: '',
    serverInput: '',
    // 发放中标记（avatars | lightcones），用于按钮 loading 态与禁止重复点击
    grantKind: '' as '' | 'avatars' | 'lightcones',
    // 搜索结果自动滚动定位
    scrollIntoViewId: ''
  },

  onLoad() {
    this.loadRecent();
  },

  onUnload() {
    // 页面关闭后停止轮询（后台注册/发放任务不受影响，完成后直接写入号池）
    (this as any)._pageClosed = true;
  },

  onPullDownRefresh() {
    this.refreshVisible().finally(() => wx.stopPullDownRefresh());
  },

  async refreshVisible() {
    const tasks: Promise<any>[] = [this.loadRecent()];
    if (this.data.listActivated) tasks.push(this.loadList(1));
    try {
      await Promise.all(tasks);
    } catch (err) {
      this.showError(err);
    }
  },

  async loadRecent() {
    try {
      const res = await yuukiApi.list('all', '', 1, RECENT_COUNT);
      const items = (res.items || []) as YuukiAccount[];
      this.setData({ recentAccounts: items.slice(0, RECENT_COUNT) });
    } catch (err) {
      this.showError(err);
    }
  },

  setRegisterCount(e: any) {
    const index = Number(e.detail.value);
    const options = this.data.registerCountOptions;
    const count = options[index] ? Number(options[index]) : 1;
    this.setData({ registerCount: Math.max(1, count), registerCountIndex: index });
  },

  async registerAccounts() {
    if (this.data.actionLoading) return;
    (this as any)._pageClosed = false;
    this.setData({ actionLoading: 'register', createdAccounts: [] });
    const hideLoading = () => {
      try { wx.hideLoading(); } catch { /* 页面已卸载等场景忽略 */ }
    };
    wx.showLoading({ title: '正在启动注册…', mask: true });
    try {
      // 启动注册后不再等同步结果：轮询 GET /register/status，账号列表在 task.items 里
      const task = await yuukiApi.register(this.data.registerCount, {
        onProgress: (t) => {
          if (t.status === 'running') {
            wx.showLoading({ title: `注册中 ${t.registered}/${t.requested}…`, mask: true });
          }
        },
        shouldAbort: () => (this as any)._pageClosed === true
      });
      if ((this as any)._pageClosed) return;
      hideLoading();

      if (task.status === 'error') {
        wx.showModal({ title: '注册失败', content: task.message || '注册失败，请稍后重试', showCancel: false });
        return;
      }

      const registered = Number(task.registered || 0);
      const failed = Number(task.failed || 0);
      const createdAccounts = (task.items || []).map((it) => ({
        id: 0,
        username: it.username,
        password: it.password,
        status: 'available' as const
      }));
      this.setData({ createdAccounts });

      if (registered > 0 && failed === 0) {
        wx.showToast({ title: `已创建 ${registered} 个`, icon: 'success' });
      } else {
        wx.showModal({
          title: '注册完成',
          content: task.message || `成功 ${registered} 个，失败 ${failed} 个`,
          showCancel: false
        });
      }

      await this.loadRecent();
    } catch (err) {
      if ((this as any)._pageClosed) return;
      hideLoading();
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

  async onSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      wx.showToast({ title: '请输入要搜索的账号', icon: 'none' });
      return;
    }
    this.setData({ status: 'all', listActivated: true, listTitle: '搜索结果', scrollIntoViewId: '' });
    await this.runListAction(() => this.loadList(1));
    // 搜索完自动滚动到结果区（结果可能在最近 10 条之外，页面下方看不到）
    wx.nextTick(() => this.setData({ scrollIntoViewId: 'search-results' }));
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
      scrollIntoViewId: ''
    });
    this.loadRecent();
  },

  async loadList(page = 1, append = false) {
    const res = await yuukiApi.list('all', this.data.keyword.trim(), page, this.data.pageSize);
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

  openAccountAction(e: any) {
    const account = this.accountFromRow(e);
    if (!account) return;
    this.setData({ actionAccount: account, showActionPopup: true });
    // 用 /grant/status 拉取最新验证/发放状态，覆盖列表里的旧数据
    this.refreshGrantStatus(account.username);
  },

  accountFromRow(e: any): YuukiAccount | null {
    const dataset = e.currentTarget.dataset;
    const username = String(dataset.username || '');
    if (!username) return null;
    return {
      id: Number(dataset.id || 0),
      username,
      password: String(dataset.password || ''),
      status: (dataset.status || 'available') as YuukiAccount['status'],
      remark: dataset.remark ? String(dataset.remark) : '',
      verify_status: dataset.verifyStatus !== undefined && dataset.verifyStatus !== '' ? Number(dataset.verifyStatus) : undefined,
      grant_status: dataset.grantStatus !== undefined && dataset.grantStatus !== '' ? Number(dataset.grantStatus) : undefined,
      uid: dataset.uid ? String(dataset.uid) : '',
      server: dataset.server ? String(dataset.server) : ''
    };
  },

  async refreshGrantStatus(username: string) {
    try {
      const res = await yuukiApi.grantStatus(username);
      const account = res && res.account;
      if (!account) return;
      const current = this.data.actionAccount;
      if (!current || current.username !== username) return;
      this.setData({
        actionAccount: {
          ...current,
          verify_status: account.verify_status !== undefined ? Number(account.verify_status) : current.verify_status,
          grant_status: account.grant_status !== undefined ? Number(account.grant_status) : current.grant_status,
          uid: account.uid ? String(account.uid) : current.uid,
          server: account.server ? String(account.server) : current.server
        }
      });
    } catch {
      // 状态刷新失败不打扰用户，保留列表已有数据
    }
  },

  closeActionPopup() {
    this.setData({ showActionPopup: false, actionAccount: null });
  },

  onPreventBubble() {
    // 阻止弹窗内容点击冒泡
  },

  copyFromPopup() {
    const account = this.data.actionAccount;
    if (!account) return;
    wx.setClipboardData({ data: `${account.username}\n${account.password}` });
    this.closeActionPopup();
  },

  allowLoginFromPopup() {
    const account = this.data.actionAccount;
    if (!account) return;
    this.closeActionPopup();
    this.executeAllowLogin(account.username, 'all');
  },

  specifyIpFromPopup() {
    const account = this.data.actionAccount;
    if (!account) return;
    this.setData({ showIpInput: true, ipSegments: ['', '', '', ''], ipFocusIndex: 0 });
  },

  closeIpInput() {
    this.setData({ showIpInput: false });
  },

  onIpSegmentInput(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    let value = String(e.detail.value || '').replace(/[^\d]/g, '').slice(0, 3);
    const ipSegments = this.data.ipSegments.slice();
    ipSegments[index] = value;
    this.setData({ ipSegments });
    if (value.length === 3 && index < 3) {
      wx.nextTick(() => this.setData({ ipFocusIndex: index + 1 }));
    }
  },

  onIpSegmentTap(e: any) {
    this.setData({ ipFocusIndex: Number(e.currentTarget.dataset.index) });
  },

  confirmIpInput() {
    const account = this.data.actionAccount;
    if (!account) return;
    const segs = this.data.ipSegments.map((s) => String(s || '').trim());
    if (segs.some((s) => !s || Number(s) < 0 || Number(s) > 255)) {
      wx.showToast({ title: '请输入完整的 IP 地址', icon: 'none' });
      return;
    }
    const ip = segs.join('.');
    this.closeIpInput();
    this.closeActionPopup();
    this.executeAllowLogin(account.username, 'ip_add', ip);
  },

  issueFromPopup() {
    const account = this.data.actionAccount;
    if (!account) return;
    this.closeActionPopup();
    wx.showModal({
      title: '标记发出',
      content: `确认将 ${account.username} 标记为「已发出」？`,
      success: (res) => {
        if (res.confirm) this.accountAction(`issue:${account.username}`, () => yuukiApi.issue(account.username), '已标记发出');
      }
    });
  },

  // ---- 搜索结果行内快捷操作（复制/允许登录/指定IP/邮箱验证/检测UID/标记发出） ----

  copyFromRow(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    const password = String(e.currentTarget.dataset.password || '');
    if (!username) return;
    wx.setClipboardData({ data: `${username}\n${password}` });
  },

  allowLoginFromRow(e: any) {
    const username = String(e.currentTarget.dataset.username || '');
    if (!username || this.data.actionLoading) return;
    this.executeAllowLogin(username, 'all');
  },

  specifyIpFromRow(e: any) {
    const account = this.accountFromRow(e);
    if (!account || this.data.actionLoading) return;
    this.setData({ actionAccount: account, showIpInput: true, ipSegments: ['', '', '', ''], ipFocusIndex: 0 });
  },

  verifyFromRow(e: any) {
    const account = this.accountFromRow(e);
    if (!account || this.data.actionLoading) return;
    this.setData({ actionAccount: account });
    this.verifyUsername(account.username);
  },

  detectUidFromRow(e: any) {
    const account = this.accountFromRow(e);
    if (!account || this.data.actionLoading) return;
    this.setData({ actionAccount: account });
    this.detectUid(account.username);
  },

  issueFromRow(e: any) {
    const account = this.accountFromRow(e);
    if (!account || this.data.actionLoading) return;
    wx.showModal({
      title: '标记发出',
      content: `确认将 ${account.username} 标记为「已发出」？`,
      success: (res) => {
        if (res.confirm) this.accountAction(`issue:${account.username}`, () => yuukiApi.issue(account.username), '已标记发出');
      }
    });
  },

  discardFromPopup() {
    const account = this.data.actionAccount;
    if (!account) return;
    this.closeActionPopup();
    wx.showModal({
      title: '废弃账号',
      content: `确认将 ${account.username} 标记为废弃？`,
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) this.accountAction(`discard:${account.username}`, () => yuukiApi.discard(account.username), '已标记废弃');
      }
    });
  },

  // ---- 发放（grant）：邮箱验证 / 检测 UID / 发放角色光锥 ----

  async verifyFromPopup() {
    const account = this.data.actionAccount;
    if (!account || this.data.actionLoading) return;
    await this.verifyUsername(account.username);
  },

  async verifyUsername(username: string) {
    this.setData({ actionLoading: 'verify' });
    try {
      const res = await yuukiApi.grantVerify(username);
      if (res && res.ok === false) throw new Error(res.error || '邮箱验证失败');
      wx.showToast({ title: '邮箱验证成功', icon: 'success' });
      await this.refreshGrantStatus(username);
      await this.refreshAfterAction();
    } catch (err) {
      // 429 限流等错误信息（含等待秒数）由后端返回，直接展示
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
  },

  async detectUidFromPopup() {
    const account = this.data.actionAccount;
    if (!account || this.data.actionLoading) return;
    await this.detectUid(account.username);
  },

  async detectUid(username: string) {
    this.setData({ actionLoading: 'detect-uid' });
    try {
      const res = await yuukiApi.grantPlayerCandidates(username);
      const candidates = ((res && res.candidates) || []) as GrantCandidate[];
      if (!candidates.length) {
        wx.showModal({
          title: '未检测到 UID',
          content: (res && res.message) || '没有找到该账号的 UID/服务器，可点击「手动输入」。',
          showCancel: false
        });
        return;
      }
      if (candidates.length === 1) {
        // 1 个自动填入
        this.saveUidSelection(candidates[0]);
        return;
      }
      // 多个：弹选择器，显示 server + uid
      this.setData({
        candidates,
        candidateLabels: candidates.map((c) => `${c.server} · ${c.uid}`),
        candidateIndex: 0,
        showUidManual: false,
        showUidPicker: true
      });
    } catch (err) {
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '' });
    }
  },

  async saveUidSelection(candidate: GrantCandidate) {
    const account = this.data.actionAccount;
    if (!account) return;
    // 记住选择，并写回后端兜底持久化（setinfo）
    this.setData({ actionAccount: { ...account, uid: candidate.uid, server: candidate.server } });
    try {
      await yuukiApi.grantSetinfo(account.username, candidate.uid, candidate.server);
      wx.showToast({ title: `已选择 ${candidate.server}`, icon: 'success' });
    } catch (err) {
      this.showError(err);
    }
    await this.refreshAfterAction();
  },

  closeUidPicker() {
    this.setData({ showUidPicker: false, showUidManual: false });
  },

  onCandidateChange(e: any) {
    this.setData({ candidateIndex: Number(e.detail.value) });
  },

  confirmCandidate() {
    const candidate = this.data.candidates[this.data.candidateIndex];
    if (!candidate) return;
    this.closeUidPicker();
    this.saveUidSelection(candidate);
  },

  switchUidManual() {
    this.setData({ showUidManual: true });
  },

  onUidInput(e: any) {
    this.setData({ uidInput: String(e.detail.value || '').trim() });
  },

  onServerInput(e: any) {
    this.setData({ serverInput: String(e.detail.value || '').trim() });
  },

  confirmUidManual() {
    const uid = this.data.uidInput.trim();
    const server = this.data.serverInput.trim();
    if (!uid || !server) {
      wx.showToast({ title: '请填写 UID 和服务器', icon: 'none' });
      return;
    }
    this.closeUidPicker();
    this.saveUidSelection({ uid, server });
  },

  grantAvatarsFromPopup() {
    this.grantFromPopup('avatars');
  },

  grantLightconesFromPopup() {
    this.grantFromPopup('lightcones');
  },

  grantFromPopup(kind: 'avatars' | 'lightcones') {
    const account = this.data.actionAccount;
    if (!account || this.data.actionLoading) return;
    // 前置条件检查：先验证 → 再选 UID → 再发放
    if ((account.verify_status ?? 0) !== 1) {
      wx.showModal({ title: '请先邮箱验证', content: '发放前需先完成「邮箱验证」解锁发放权限。', showCancel: false });
      return;
    }
    const uid = account.uid && account.uid.trim();
    const server = account.server && account.server.trim();
    if (!uid || !server) {
      wx.showModal({ title: '请先检测 UID', content: '未找到该账号的 UID/服务器，请先「检测 UID」或手动输入。', showCancel: false });
      return;
    }
    const label = kind === 'avatars' ? '全部角色' : '全部光锥';
    wx.showModal({
      title: `发放${label}`,
      content: `确认给 ${account.username}（${server} · ${uid}）发放${label}？\n注意：账号需在游戏内在线，发放期间请勿退出游戏。`,
      confirmColor: '#1677ff',
      success: (res) => {
        if (res.confirm) this.doGrant(kind, account.username, uid, server);
      }
    });
  },

  async doGrant(kind: 'avatars' | 'lightcones', username: string, uid: string, server: string) {
    this.setData({ actionLoading: 'grant', grantKind: kind });
    const label = kind === 'avatars' ? '角色' : '光锥';
    const hideLoading = () => {
      try { wx.hideLoading(); } catch { /* 页面已卸载等场景忽略 */ }
    };
    wx.showLoading({ title: `发放${label}中…`, mask: true });
    try {
      // 提交后轮询 /grant/status 显示进度，直到任务结束
      const result = await yuukiApi.grant(kind, username, uid, server, {
        onProgress: (task) => {
          const progress = task && typeof task.progress === 'number' ? task.progress : null;
          wx.showLoading({ title: progress !== null ? `发放${label}中 ${progress}%…` : `发放${label}中…`, mask: true });
        },
        shouldAbort: () => (this as any)._pageClosed === true
      });
      if ((this as any)._pageClosed) return;
      hideLoading();

      const task = result.task || {};
      const acc = result.account || {};
      const grantStatus = acc.grant_status !== undefined ? Number(acc.grant_status) : undefined;
      const failed = grantStatus === 3 || task.status === 'error' || task.status === 'failed' || task.status === 'fail';
      const message = task.message || (failed ? `发放${label}失败` : `发放${label}完成`);
      wx.showModal({
        title: failed ? '发放失败' : '发放完成',
        content: String(message),
        showCancel: false
      });
      await this.refreshGrantStatus(username);
      await this.refreshAfterAction();
    } catch (err) {
      if ((this as any)._pageClosed) return;
      hideLoading();
      this.showError(err);
    } finally {
      this.setData({ actionLoading: '', grantKind: '' });
    }
  },

  executeAllowLogin(username: string, typ: 'all' | 'ip_add', ip = '') {
    if (!username || this.data.actionLoading) return;
    const successText = typ === 'all' ? '已允许登录' : ip ? `已指定 IP ${ip}` : '已允许服务器 IP';
    this.accountAction(
      `allow:${username}:${typ}:${ip}`,
      () => yuukiApi.allowLogin(username, typ, ip),
      successText,
      true
    );
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
    const tasks: Promise<any>[] = [this.loadRecent()];
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
