// app.ts
App<IAppOption>({
  globalData: {},
  onLaunch() {
    try {
      // 展示本地存储能力
      const logs = wx.getStorageSync('logs') || []
      logs.unshift(Date.now())
      wx.setStorageSync('logs', logs)

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
  onUnhandledRejection(res: WechatMiniprogram.OnUnhandledRejectionCallbackResult) {
    const errorMsg = res.reason || res.error || (typeof res === 'string' ? res : JSON.stringify(res));
    console.error('未处理的Promise拒绝:', errorMsg, res);
    // 处理未捕获的 Promise 拒绝
  }
})