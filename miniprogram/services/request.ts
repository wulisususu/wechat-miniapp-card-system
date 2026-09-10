import { backendConfig } from './config';

export const API_BASE_URL = backendConfig.apiBaseUrl;

export interface RequestOptions {
  method?: 'GET' | 'POST';
  data?: any;
  timeout?: number;
  header?: Record<string, string>;
}

function buildAuthHeader(): Record<string, string> {
  const { username, password } = backendConfig;
  if (!username || !password) return {};
  const token = `${username}:${password}`;
  let encoded = '';
  try {
    // 小程序端没有 btoa，使用 wx API 做 Base64 编码（UTF-8）
    const bytes = new Uint8Array(token.length);
    for (let i = 0; i < token.length; i++) {
      bytes[i] = token.charCodeAt(i);
    }
    encoded = wx.arrayBufferToBase64(bytes.buffer);
  } catch {
    console.error('Basic Auth 编码失败:');
    return {};
  }
  return { Authorization: `Basic ${encoded}` };
}

export function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const header = Object.assign(
      { 'Content-Type': 'application/json' },
      options.header || {},
      buildAuthHeader()
    );
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 10000,
      header,
      success: (res) => {
        const data = res.data as any;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data as T);
          return;
        }
        const detail = (data && (data.detail || data.error || data.message)) || `HTTP ${res.statusCode}`;
        const err = new Error(detail) as Error & { statusCode?: number };
        err.statusCode = res.statusCode;
        if (res.statusCode === 401) {
          // 401 只代表「本版本内置的凭证被服务器拒绝」，真机上无法去看 config.local.ts，
          // 因此提示要指向可执行动作：更新配置并重新上传版本。
          err.message = '认证失败（401）：后端凭证失效，请更新配置后重新上传';
        }
        reject(err);
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
    });
  });
}
