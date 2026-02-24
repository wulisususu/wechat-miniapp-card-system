# 微信小程序卡密系统

一个用于管理和操作卡密的微信小程序前端项目。本仓库只包含小程序前端代码，不包含服务端实现。

> 注意：本仓库面向公开开源，所有与个人项目相关的敏感信息（如真实小程序 appid、真实后端域名）均已移除或使用占位符。请根据下方说明自行配置。

## 功能概览

- 基于聊天界面的卡密管理与指令交互
- 支持发送文本指令，例如：
  - `删除 123456`
  - `重置对话`
- 支持本地消息历史记录保存与展示

## 目录结构

- `miniprogram/` 小程序源码目录
  - `app.ts` 小程序入口
  - `pages/chat/` 聊天页面
- `project.config.json` 微信开发者工具项目配置

## 环境要求

- 微信开发者工具（建议使用最新版）
- Node.js（如需使用 npm 相关功能，可选）

## 使用步骤

### 1. 克隆项目

```bash
git clone https://github.com/wulisususu/wechat-miniapp-card-system.git
cd 微信小程序卡密系统
```

### 2. 配置小程序 appid

本仓库中的 `project.config.json` 使用的是占位 appid：

```json
"appid": "wx0000000000000000"
```

请根据以下步骤替换为你自己的小程序 appid：

1. 在微信公众平台 / 微信开发者工具中创建/查看你的小程序。
2. 复制你的小程序 `AppID`。
3. 打开项目根目录下的 `project.config.json`，将 `appid` 字段替换为你自己的 AppID。

> 建议：如果你将本仓库 fork 后继续开源，保持使用占位 appid，不要提交真实 appid 到公共仓库。

### 3. 配置后端接口地址

聊天页面会调用后端接口进行处理，请在 `miniprogram/pages/chat/index.ts` 中配置你的后端地址：

```ts
const BASE_URL = 'https://your-backend-domain.com'; // 后端基地址（占位示例）
const API_PATH = '/api/wechat/message';
```

请将 `https://your-backend-domain.com` 替换为你自己的后端服务地址，例如：

```ts
const BASE_URL = 'https://api.example.com';
```

> 安全建议：不要在公开仓库中提交你真实的个人/生产服务器域名，可在本地维护一份私有配置文件，或在提交前将域名改为占位值。

后端接口需满足：

- 请求方式：`POST`
- 地址：`{BASE_URL}{API_PATH}`，例如 `https://api.example.com/api/wechat/message`
- 请求体示例：

```json
{
  "user_id": "miniuser-xxx",
  "msg_type": "text",
  "content": "删除 123456"
}
```

- 返回体示例：

```json
{
  "ok": true,
  "reply": {
    "content": "删除成功" 
  }
}
```

## 在微信开发者工具中导入运行

1. 打开微信开发者工具，选择「导入项目」。
2. 选择本项目根目录（包含 `project.config.json` 的目录）。
3. 填写或确认小程序 `AppID`。
4. 导入后即可在开发者工具中预览、调试小程序。

## 自行二次开发建议

- 如需添加更多页面，可在 `miniprogram/pages/` 下创建新页面目录，并在 `app.json` 中配置路由。
- 如需扩展指令功能，可以在 `pages/chat/index.ts` 对发送/接收消息的逻辑进行扩展，或在后端处理更多指令。

## 安全与隐私提示

- 请不要在公开仓库中提交：
  - 真实小程序 `appsecret`
  - 数据库账号密码
  - 第三方服务密钥（如支付、短信、对象存储等）
  - 访问日志、包含用户敏感信息的文件
- 推荐将这些敏感信息保存在服务端或环境变量中，而不是前端仓库。

## License

请根据你的需要补充许可证说明，例如：MIT、Apache-2.0 或保留所有权利。
