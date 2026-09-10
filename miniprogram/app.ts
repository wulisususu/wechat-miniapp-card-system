// app.ts

/**
 * 官方 typings 把 onUnhandledRejection 的 reason 声明为 string，运行时通常传的是
 * Error 对象；这里按实际运行时形态描述，避免引用并不存在的 res.error 字段。
 */
type UnhandledRejectionPayload = Omit<WechatMiniprogram.OnUnhandledRejectionCallbackResult, 'reason'> & {
  reason?: unknown
}

function describeRejectionReason(reason: unknown): string {
  if (typeof reason === 'string') return reason || '未知错误'
  if (reason instanceof Error) return reason.message || String(reason)
  if (reason === undefined || reason === null) return '未知错误'
  if (typeof reason === 'object') {
    try {
      return JSON.stringify(reason) || '未知错误'
    } catch (_err) {
      return '拒绝原因无法序列化'
    }
  }
  return String(reason)
}

App<IAppOption>({
  globalData: {},
  onLaunch() {
    try {
      // 登录
      wx.login({
        success: res => {
          console.log('登录成功:', res.code)
          // 发送 res.code 到后台换取 openId, sessionKey, unionId
        },
        fail: err => {
          console.error('登录失败:', err)
        }
      })
    } catch (err) {
      console.error('应用启动错误:', err)
    }
  },
  onError(error: string) {
    console.error('全局错误:', error)
    // 可以将错误上报到监控平台
  },
  onUnhandledRejection(res: UnhandledRejectionPayload) {
    console.error('未处理的Promise拒绝:', describeRejectionReason(res.reason), res)
    // 处理未捕获的 Promise 拒绝
  }
})