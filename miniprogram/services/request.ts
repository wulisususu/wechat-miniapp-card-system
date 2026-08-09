export const API_BASE_URL = 'https://your-backend-domain.com';

export interface RequestOptions {
  method?: 'GET' | 'POST';
  data?: any;
  timeout?: number;
  header?: Record<string, string>;
}

export function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 10000,
      header: Object.assign({ 'Content-Type': 'application/json' }, options.header || {}),
      success: (res) => {
        const data = res.data as any;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data as T);
          return;
        }
        reject(new Error((data && (data.detail || data.error || data.message)) || `HTTP ${res.statusCode}`));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败'))
    });
  });
}
