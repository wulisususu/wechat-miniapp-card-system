// 统一后端配置。默认值为占位符（公开仓库可提交）。
// 如需本地覆盖（真实域名 / Basic Auth 凭证），复制 config.local.example.ts 为
// config.local.ts 并填写真实值。config.local.ts 已被 .gitignore 忽略，不会进入公开仓库。

export interface BackendConfig {
  apiBaseUrl: string;
  username: string;
  password: string;
}

const DEFAULT_CONFIG: BackendConfig = {
  apiBaseUrl: 'https://your-backend-domain.com',
  username: '',
  password: ''
};

function loadLocalConfig(): Partial<BackendConfig> {
  try {
    const local = require('./config.local');
    if (local && typeof local === 'object') {
      return local as Partial<BackendConfig>;
    }
  } catch {
    // 本地配置文件不存在时使用默认占位符
  }
  return {};
}

const localConfig = loadLocalConfig();

export const backendConfig: BackendConfig = {
  apiBaseUrl: localConfig.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
  username: localConfig.username || DEFAULT_CONFIG.username,
  password: localConfig.password || DEFAULT_CONFIG.password
};
