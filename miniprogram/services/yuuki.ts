import { request } from './request';

export interface YuukiAccount {
  id: number;
  username: string;
  password: string;
  status: 'available' | 'issued' | 'discarded';
  source?: string;
  remark?: string;
  created_at?: string;
}

const PREFIX = '/api/yuuki-pool';

export const yuukiApi = {
  stats: () => request<any>(`${PREFIX}/stats`),
  list: (status: string, keyword: string, page: number, pageSize = 50) =>
    request<any>(`${PREFIX}/list?status=${encodeURIComponent(status)}&keyword=${encodeURIComponent(keyword)}&page=${page}&page_size=${pageSize}`),
  register: (count: number) => request<any>(`${PREFIX}/register`, { method: 'POST', data: { count, by: 'miniapp' }, timeout: 45000 }),
  next: (note = 'miniapp') => request<any>(`${PREFIX}/next?note=${encodeURIComponent(note)}`, { timeout: 15000 }),
  release: (username: string) => request<any>(`${PREFIX}/release`, { method: 'POST', data: { username, operator: 'miniapp' } }),
  discard: (username: string) => request<any>(`${PREFIX}/discard`, { method: 'POST', data: { username, operator: 'miniapp' } }),
  allowLogin: (username: string, typ: 'all' | 'ip_add') => request<any>(`${PREFIX}/allowlogin`, {
    method: 'POST',
    data: { username, typ, by: 'miniapp' },
    timeout: 15000
  })
};
