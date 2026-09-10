# 微信小程序管理端

用于激活码（测试服激活码业务）指令管理与 Yuuki 账号号池管理的微信小程序前端。

> 本仓库保持公开可迁移：真实 AppID、生产后端域名、管理员凭证等不提交到仓库。服务端实现不包含在本仓库中。

## 审核命名约定（重要）

小程序内所有**面向用户的文案**不得出现「测试」字样，也不要残留微信官方模板页。业务上「激活码服务」对应的就是测试服的激活码，只是展示名不能写成"测试服"——否则会被《微信小程序平台运营规范》3.3（内容必须正式，不得以 Demo/测试形式提交）判定为测试内容而拒审。

- 展示名统一为 **激活码服务**（抽屉项、顶栏标题、首条消息、分享标题）；
- 业务标识符使用 `activation`（`data-target="activation"`、`current="activation"`），不使用 `test-server`；
- 微信官方模板页（`pages/index` Hello World、`pages/logs` 启动日志）与其专属组件 `components/navigation-bar`、`utils/util.ts` 已全部删除；
- `tests/review-copy.test.ps1` 守卫以上三条，改名或加页面时会被拦住。

## 当前交互

- 默认启动页仍为 `pages/chat/index`，打开小程序直接进入激活码服务，不增加中间首页。
- 左上角统一业务切换抽屉：`激活码服务` / `Yuuki 号池`。
- 激活码服务继续使用原有 `/api/wechat/message` 协议。
- Yuuki 号池使用独立手机管理页，当前能力：
  - 在线注册 1 / 2 / 3 / 5 / 10 / 20 个：提交后台任务后轮询进度，账号完成后写入号池；
  - 搜索账号或备注：搜索激活时隐藏「最近账号」列表，结果区显示总数并支持分页加载；
  - 搜索结果行内快捷操作：复制账号密码、允许登录、指定 IP、邮箱验证、检测 UID、标记发出；
  - 账号操作弹窗（点击任意账号行）：验证/发放状态、复制、允许登录、指定 IP、邮箱验证、检测 UID、标记发出、发放满级满命全角色、解锁全部剧情/任务、发放满级满精全光锥、解除卡场景/卡加载、废弃。
- 「高级功能」与 web 后台（`/ui/yuuki.html` 的「高级功能」面板）逐项对齐，前置条件集中在 `services/yuuki.ts` 的 `grantPrecondition()`，并由 `tests/yuuki-grant-contract.test.ts` 守卫：
  - `avatars` / `lightcones`：需先邮箱验证（`verify_status == 1`），且已有 `uid` + `server`；
  - `unlock`：需先邮箱验证，UID 由后端自行探测；
  - `unstuck`：无需邮箱验证、无需 UID 前置（后端 `require_verify=False`），账号需在游戏内登录过。
- 已废弃账号仅保留业务标记，前端不再显示 allowlogin / 发放类操作。
- `services/yuuki.ts` 中的 `stats`（库存统计）、`next`（FIFO 取号）、`release`（回池）、`grantProbe` 仍保留封装，但页面当前未直接调用；页面「标记发出」实际请求 `/next`。

## 目录结构

```text
miniprogram/
├── app.ts
├── app.json
├── components/
│   └── business-switcher/   # 左上角业务切换抽屉
├── pages/
│   ├── chat/                # 激活码服务（默认入口）
│   └── yuuki/               # Yuuki 号池手机管理页
└── services/
    ├── request.ts            # 统一请求层（读取配置并附加 Basic Auth）
    ├── config.ts             # 配置默认值（占位符，可提交）
    ├── config.local.ts       # 本地配置（真实地址/凭证，已 gitignore，不入库）
    ├── config.local.example.ts # 本地配置模板
    └── yuuki.ts              # Yuuki API 封装（含注册/发放轮询）

tests/
├── yuuki-list-path.test.ts        # 列表请求必须使用 GET 查询参数
├── yuuki-grant-contract.test.ts   # 高级功能前置条件与请求契约（含 unlock / unstuck）
├── review-copy.test.ps1           # 审核守卫：无「测试」文案、无模板残留
├── yuuki-search-layout.test.ps1   # 搜索激活时必须隐藏「最近账号」
└── yuuki-grant-ui.test.ps1        # 高级功能按钮必须绑定统一的 grantFromPopup

typings/                          # 内嵌 wx 类型声明（含一处 TypeScript 7 兼容补丁）
docs/superpowers/                 # 设计与计划文档
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

激活码服务接口（业务上对应测试服）：

```text
POST /api/wechat/message
```

Yuuki 页面当前复用的号池后端接口：

```text
页面当前调用：

GET  /api/yuuki-pool/list?status=&keyword=&page=&page_size=
POST /api/yuuki-pool/register
GET  /api/yuuki-pool/register/status
GET  /api/yuuki-pool/next?note=&operator=
POST /api/yuuki-pool/discard
POST /api/yuuki-pool/allowlogin

发放（grant）系列：

POST /api/yuuki-pool/grant/verify
POST /api/yuuki-pool/grant/player-candidates
POST /api/yuuki-pool/grant/setinfo
POST /api/yuuki-pool/grant/avatars
POST /api/yuuki-pool/grant/unlock
POST /api/yuuki-pool/grant/lightcones
POST /api/yuuki-pool/grant/unstuck
GET  /api/yuuki-pool/grant/status?username=xxx

已封装但页面未调用（后端仍提供）：

GET  /api/yuuki-pool/stats
POST /api/yuuki-pool/release
POST /api/yuuki-pool/grant/probe
```

> `list` 使用 GET 查询参数（`tests/yuuki-list-path.test.ts` 守卫该行为）；后端保留 POST 兼容路由，但小程序不再依赖它。

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

## 本地校验

```bash
npm run typecheck        # tsc --noEmit，必须无错误
```

TypeScript 测试需要先编译再运行（`tests/yuuki-list-path.test.ts` 依赖 `wx.arrayBufferToBase64` 类型声明）：

```powershell
$out = Join-Path $env:TEMP 'mp-test'
npx tsc tests/yuuki-list-path.test.ts tests/yuuki-grant-contract.test.ts --ignoreConfig --outDir $out `
  --module CommonJS --target ES2020 --lib ES2020 --skipLibCheck --rootDir .
node (Join-Path $out 'tests\yuuki-list-path.test.js')
node (Join-Path $out 'tests\yuuki-grant-contract.test.js')
```

WXML 布局守卫测试（Windows PowerShell）：

```powershell
& .\tests\review-copy.test.ps1        # 审核守卫：无「测试」文案 / 无模板残留
& .\tests\yuuki-search-layout.test.ps1
& .\tests\yuuki-grant-ui.test.ps1
```

- `yuuki-search-layout` / `yuuki-grant-ui` 可加 `-TemplatePath <path>` 指向任意 wxml，用于先验证测试会失败（红），再验证修改后通过（绿）；`review-copy` 可加 `-MiniprogramRoot <path>`。
- 这些脚本必须保存为 **UTF-8 with BOM**：Windows PowerShell 5.1 会把无 BOM 的 UTF-8 脚本按本地代码页解析，中文注释末尾字节可能吞掉换行符，导致下一条语句被并入注释。

### typings 兼容补丁

`typings/types/wx/lib.wx.app.d.ts` 中 `GetApp` 的泛型补上了 `T extends IAnyObject` 约束。上游 `miniprogram-api-typings`（2.12.0）声明为 `<T = IAnyObject>`，默认值满足约束但 `T` 本身不满足，TypeScript 7 会报 `TS2344: Type 'T' does not satisfy the constraint 'IAnyObject'`。该补丁只影响类型检查，不改变运行时行为；若日后覆盖或重新内嵌该 typings 目录，需要重新补上。

## 微信开发者工具运行

1. `git pull` 获取最新代码。
2. 用微信开发者工具打开仓库根目录（包含 `project.config.json`）。
3. 确认本地实际 AppID，以及 `miniprogram/services/config.local.ts` 的后端地址与 Basic Auth 凭证（模板见 `config.local.example.ts`）。
4. 开发阶段可在开发者工具中调试；真机/体验版必须配置合法 HTTPS request 域名。
5. 默认进入激活码服务，点击左上角按钮切换到 Yuuki 号池。

### 提审前检查清单

1. `git pull` 后在开发者工具里重新编译，确认两个页面都能打开、按钮有响应；
2. 运行上面「本地校验」里的全部命令，确保 `review-copy` 守卫通过；
3. 确认后端证书未过期（`echo | openssl s_client -connect <域名>:443 2>/dev/null | openssl x509 -noout -dates`）——证书过期会让审核员看到"请求全部失败"，直接命中 3.3.1；
4. 确认后端域名已加入公众平台「开发管理 → 服务器域名 → request 合法域名」；
5. 建议在审核备注里说明功能路径与（如有）测试账号，满足 3.3.4。

## 安全提示

不要在小程序前端提交数据库密码、管理员 Basic Auth 密码、第三方 Secret 或其他服务端密钥；这些信息都可能从客户端包中被读取。
