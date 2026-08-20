# 微信小程序管理端

用于测试服指令/卡密管理与 Yuuki 账号号池管理的微信小程序前端。

> 本仓库保持公开可迁移：真实 AppID、生产后端域名、管理员凭证等不提交到仓库。服务端实现不包含在本仓库中。

## 当前交互

- 默认启动页仍为 `pages/chat/index`，打开小程序直接进入测试服聊天，不增加中间首页。
- 左上角统一业务切换抽屉：`测试服` / `Yuuki 号池`。
- 测试服聊天继续使用原有 `/api/wechat/message` 协议。
- Yuuki 号池使用独立手机管理页，支持：库存统计、在线注册 1~3 个、FIFO 取号、搜索/筛选、复制账号密码、回池、废弃标记、允许所有 IP、允许服务器当前 IP。
- 已废弃账号仅保留业务标记，前端不会继续显示 allowlogin 操作。

## 目录结构

```text
miniprogram/
├── app.ts
├── app.json
├── components/
│   └── business-switcher/   # 左上角业务切换抽屉
├── pages/
│   ├── chat/                # 默认测试服聊天
│   ├── yuuki/               # Yuuki 号池手机管理页
│   ├── index/               # 历史模板页，当前非默认入口
│   └── logs/
└── services/
    ├── request.ts            # 统一请求层（读取配置并附加 Basic Auth）
    ├── config.ts             # 配置默认值（占位符，可提交）
    ├── config.local.ts       # 本地配置（真实地址/凭证，已 gitignore，不入库）
    ├── config.local.example.ts # 本地配置模板
    └── yuuki.ts              # Yuuki API 封装
```

## 配置

### AppID

`project.config.json` 中仍使用占位 AppID，请在本地微信开发者工具中替换为实际 AppID，不要把生产 AppID/Secret 当作服务端密钥使用。

### 后端地址与认证

后端基地址和 Basic Auth 凭证统一从 `services/config.local.ts` 读取（该文件已 `.gitignore`，不会进入公开仓库）。默认回退到 `services/config.ts` 中的占位符。

本地调试步骤：

1. 复制模板 `miniprogram/services/config.local.example.ts` 为 `miniprogram/services/config.local.ts`；
2. 填入真实值：

```ts
// miniprogram/services/config.local.ts（不入库）
export const apiBaseUrl = 'http://124.223.176.99';   // 开发期可用 IP
export const username = 'your-basic-auth-username';  // 号池 Basic Auth 账号
export const password = 'your-basic-auth-password';  // 号池 Basic Auth 密码
```

- 开发者工具模拟器使用 `http://IP` 时，需要在工具「详情 → 本地设置」关闭"校验合法域名"；
- 正式上线必须使用已备案的 HTTPS 域名，并在微信公众平台「开发管理 → 服务器域名」配置为 request 合法域名。

测试服接口：

```text
POST /api/wechat/message
```

Yuuki 页面当前复用现有号池后端：

```text
GET  /api/yuuki-pool/stats
GET  /api/yuuki-pool/list
POST /api/yuuki-pool/register
GET  /api/yuuki-pool/register/status
GET  /api/yuuki-pool/next
POST /api/yuuki-pool/release
POST /api/yuuki-pool/discard
POST /api/yuuki-pool/allowlogin

发放（grant）系列：

POST /api/yuuki-pool/grant/verify
POST /api/yuuki-pool/grant/probe
POST /api/yuuki-pool/grant/player-candidates
POST /api/yuuki-pool/grant/avatars
POST /api/yuuki-pool/grant/lightcones
GET  /api/yuuki-pool/grant/status?username=xxx
POST /api/yuuki-pool/grant/setinfo
```

> 号池接口受 nginx Basic Auth 保护（`401 realm="Card Backend"`），`request.ts` 会自动附加 `Authorization: Basic ...`。公开仓库不保存真实生产域名或认证信息。

## 聊天流畅度改造

旧聊天页曾同时使用多组 `setTimeout`、DOM 高度查询、`scrollTop` 和 `scroll-into-view` 反复兜底，消息更新时容易出现多次布局和抖动。当前版本改为：

- 每条消息稳定 ID；
- 单一 `scroll-into-view` 锚点；
- DOM 更新后通过 `wx.nextTick` 滚动；
- 历史消息最多保留最近 100 条，降低长列表更新成本；
- 减少一次消息发送过程中的重复 `setData` 和节点测量；
- 抽屉动画只使用 `transform/opacity`，避免频繁布局；
- 聊天视觉改为轻量气泡 + 浮层输入框，不引入额外重型 UI 依赖。

实现思路参考微信小程序官方长列表/组件生态以及腾讯 TDesign MiniProgram 的组件分层方式，但未复制其业务逻辑，也未引入其完整组件库。

## 微信开发者工具运行

1. `git pull` 获取最新代码。
2. 用微信开发者工具打开仓库根目录（包含 `project.config.json`）。
3. 确认本地实际 AppID 与 `services/request.ts` 的生产 API 地址。
4. 开发阶段可在开发者工具中调试；真机/体验版必须配置合法 HTTPS request 域名。
5. 默认进入测试服聊天，点击左上角按钮切换到 Yuuki 号池。

## 安全提示

不要在小程序前端提交数据库密码、管理员 Basic Auth 密码、第三方 Secret 或其他服务端密钥；这些信息都可能从客户端包中被读取。
