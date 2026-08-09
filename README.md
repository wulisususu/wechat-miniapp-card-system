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
    ├── request.ts            # 统一请求层/后端基地址
    └── yuuki.ts              # Yuuki API 封装
```

## 配置

### AppID

`project.config.json` 中仍使用占位 AppID，请在本地微信开发者工具中替换为实际 AppID，不要把生产 AppID/Secret 当作服务端密钥使用。

### 后端地址

统一修改：

```ts
// miniprogram/services/request.ts
export const API_BASE_URL = 'https://your-backend-domain.com';
```

测试服接口：

```text
POST /api/wechat/message
```

Yuuki 页面当前复用现有号池后端：

```text
GET  /api/yuuki-pool/stats
GET  /api/yuuki-pool/list
POST /api/yuuki-pool/register
GET  /api/yuuki-pool/next
POST /api/yuuki-pool/release
POST /api/yuuki-pool/discard
POST /api/yuuki-pool/allowlogin
```

正式微信小程序请求仍需要使用微信公众平台配置过的 HTTPS request 合法域名。公开仓库不保存真实生产域名或认证信息。

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
