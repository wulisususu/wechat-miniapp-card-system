import { request } from './request';

export interface YuukiAccount {
  id: number;
  username: string;
  password: string;
  status: 'available' | 'issued' | 'discarded';
  source?: string;
  remark?: string;
  created_at?: string;
  /** 0=未验证 1=已验证 2=失败 */
  verify_status?: number;
  /** 0=未发放 1=发放中 2=完成 3=失败 */
  grant_status?: number;
  uid?: string;
  server?: string;
}

export type YuukiRegisterStatus = 'running' | 'done' | 'error';

export interface YuukiRegisterItem {
  username: string;
  password: string;
  uid: number;
  pool_added: boolean;
}

export interface YuukiRegisterTask {
  status: YuukiRegisterStatus;
  registered: number;
  failed: number;
  requested: number;
  items: YuukiRegisterItem[];
  message: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface YuukiRegisterOptions {
  /** 每次拿到任务快照时回调（含启动快照与每次轮询），可用于刷新进度 UI */
  onProgress?: (task: YuukiRegisterTask) => void;
  /** 轮询间隔，默认 2500ms（后端建议 2~3 秒） */
  pollIntervalMs?: number;
  /** 最大轮询次数，默认 120 次（约 5 分钟） */
  maxAttempts?: number;
  /** 返回 true 时中止轮询（如页面已卸载），后台任务仍会继续执行 */
  shouldAbort?: () => boolean;
}

export interface GrantCandidate {
  uid: string;
  server: string;
}

export interface GrantTaskInfo {
  task_id?: string;
  status?: string;
  message?: string;
  progress?: number;
  [key: string]: any;
}

export interface GrantAccountInfo {
  verify_status?: number;
  grant_status?: number;
  uid?: string;
  server?: string;
  [key: string]: any;
}

export interface GrantStatusResult {
  username: string;
  task?: GrantTaskInfo | null;
  account?: GrantAccountInfo | null;
}

export interface GrantOptions {
  /** 每次拿到任务/账号快照时回调，可用于刷新进度 UI */
  onProgress?: (task: GrantTaskInfo | null, account: GrantAccountInfo | null) => void;
  /** 轮询间隔，默认 3000ms */
  pollIntervalMs?: number;
  /** 最大轮询次数，默认 60 次（约 3 分钟） */
  maxAttempts?: number;
  /** 返回 true 时中止轮询（如页面已卸载），后台任务仍会继续执行 */
  shouldAbort?: () => boolean;
}

const PREFIX = '/api/yuuki-pool';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function parseTask(res: any): YuukiRegisterTask {
  const task = res && res.task ? (res.task as YuukiRegisterTask) : null;
  if (!task || !task.status) throw new Error('获取注册任务状态失败');
  return task;
}

async function pollRegisterStatus(options: YuukiRegisterOptions = {}): Promise<YuukiRegisterTask> {
  const interval = options.pollIntervalMs || 2500;
  const maxAttempts = options.maxAttempts || 120;
  let attempts = 0;
  for (;;) {
    if (options.shouldAbort && options.shouldAbort()) {
      throw new Error('注册任务已取消轮询，后台任务仍将继续，稍后可到号池查看结果');
    }
    const task = parseTask(await request<any>(`${PREFIX}/register/status`, { timeout: 15000 }));
    if (options.onProgress) options.onProgress(task);
    if (task.status === 'done' || task.status === 'error') return task;
    if (++attempts >= maxAttempts) throw new Error('注册任务超时，请稍后到号池查看结果');
    await sleep(interval);
  }
}

export const yuukiApi = {
  stats: () => request<any>(`${PREFIX}/stats`, { method: 'POST', data: {} }),
  list: (status: string, keyword: string, page: number, pageSize = 50) =>
    request<any>(`${PREFIX}/list`, { method: 'POST', data: { status, keyword, page, page_size: pageSize } }),
  /**
   * 启动注册任务并轮询直到完成。
   * POST /register 只返回任务快照，账号列表在 GET /register/status 的 task.items 中；
   * 若已有任务在进行中（HTTP 400），不重复提交，直接轮询现有任务。
   */
  register: async (count: number, options: YuukiRegisterOptions = {}): Promise<YuukiRegisterTask> => {
    let task: YuukiRegisterTask;
    try {
      task = parseTask(
        await request<any>(`${PREFIX}/register`, {
          method: 'POST',
          data: { count, by: 'miniapp' },
          timeout: 20000
        })
      );
    } catch (err: any) {
      // 已有注册任务在进行中：继续轮询 status 即可，不要重复提交
      if (err && err.statusCode === 400) {
        return pollRegisterStatus(options);
      }
      throw err;
    }
    if (options.onProgress) options.onProgress(task);
    if (task.status === 'done' || task.status === 'error') return task;
    return pollRegisterStatus(options);
  },
  /**
   * 发放全部角色/光锥（后台任务）：提交后轮询 /grant/status 直到任务结束。
   * 前置条件（前端需检查）：verify_status==1 且已有 uid+server，且账号需在游戏内在线。
   */
  grant: async (
    kind: 'avatars' | 'lightcones',
    username: string,
    uid: string,
    server: string,
    options: GrantOptions = {}
  ): Promise<GrantStatusResult> => {
    const res = await request<any>(`${PREFIX}/grant/${kind}`, {
      method: 'POST',
      data: { username, uid, server },
      timeout: 20000
    });
    const task = (res && res.task) || null;
    const account = (res && res.account) || null;
    if (options.onProgress) options.onProgress(task, account);
    // 提交即返回最终状态时无需轮询
    if (task && task.status && task.status !== 'running') return { username, task, account };

    const interval = options.pollIntervalMs || 3000;
    const maxAttempts = options.maxAttempts || 60;
    let attempts = 0;
    for (;;) {
      if (options.shouldAbort && options.shouldAbort()) {
        throw new Error('发放任务已取消轮询，后台任务仍将继续，稍后可查看状态');
      }
      const r = await request<any>(`${PREFIX}/grant/status?username=${encodeURIComponent(username)}`, { timeout: 15000 });
      const t = (r && r.task) || null;
      const acc = (r && r.account) || null;
      if (options.onProgress) options.onProgress(t, acc);
      if (!t || !t.status) throw new Error('获取发放任务状态失败');
      if (t.status !== 'running') return { username, task: t, account: acc };
      if (++attempts >= maxAttempts) throw new Error('发放任务超时，请稍后查看发放状态');
      await sleep(interval);
    }
  },
  next: (note = 'miniapp') => request<any>(`${PREFIX}/next?note=${encodeURIComponent(note)}`, { timeout: 15000 }),
  issue: (username: string) => request<any>(`${PREFIX}/next?note=${encodeURIComponent(username)}&operator=miniapp`, { timeout: 15000 }),
  release: (username: string) => request<any>(`${PREFIX}/release`, { method: 'POST', data: { username, operator: 'miniapp' } }),
  discard: (username: string) => request<any>(`${PREFIX}/discard`, { method: 'POST', data: { username, operator: 'miniapp' } }),
  allowLogin: (username: string, typ: 'all' | 'ip_add', ip = '') => request<any>(`${PREFIX}/allowlogin`, {
    method: 'POST',
    data: { username, typ, ip, by: 'miniapp' },
    timeout: 15000
  }),

  // ---- 发放（grant）系列：邮箱验证 / UID 检测 / 发放角色光锥 ----

  /** 邮箱验证（绕过），成功解锁发放权限；429 限流时后端会返回含等待秒数的错误信息 */
  grantVerify: (username: string) => request<any>(`${PREFIX}/grant/verify`, { method: 'POST', data: { username }, timeout: 20000 }),
  /** 探测账号真实验证状态（只读），回填 UID/服务器 */
  grantProbe: (username: string) => request<any>(`${PREFIX}/grant/probe`, { method: 'POST', data: { username }, timeout: 20000 }),
  /** 检测全部服务器上的 UID：candidates: [{uid, server}]；1 个自动填入，多个让用户选 */
  grantPlayerCandidates: (username: string) =>
    request<any>(`${PREFIX}/grant/player-candidates`, { method: 'POST', data: { username }, timeout: 20000 }),
  /** 手动设置 UID/服务器（兜底持久化） */
  grantSetinfo: (username: string, uid: string, server: string) =>
    request<any>(`${PREFIX}/grant/setinfo`, { method: 'POST', data: { username, uid, server }, timeout: 15000 }),
  /** 查询验证/发放状态 + 任务进度 */
  grantStatus: (username: string) =>
    request<any>(`${PREFIX}/grant/status?username=${encodeURIComponent(username)}`, { timeout: 15000 })
};
