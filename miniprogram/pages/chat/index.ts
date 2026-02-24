// chat/index.ts
const BASE_URL = 'https://your-backend-domain.com'; // 后端基地址（示例，占位值，请替换为你自己的后端域名）
const API_PATH = '/api/wechat/message';
const MESSAGES_STORAGE_KEY = 'chat_messages_history'; // 历史记录存储键
const MAX_MESSAGE_COUNT = 100; // 最大消息数量
const SCROLL_DEBOUNCE_DELAY = 150; // 滚动防抖延迟（毫秒）
const REQUEST_TIMEOUT = 10000; // 请求超时时间（10秒）
const MAX_SCROLL_TOP = 999999; // 最大滚动距离

function getUserId(): string {
  // 简单生成/持久化一个本地 user_id，模拟 openid
  const key = 'chat_user_id';
  const cached = wx.getStorageSync(key);
  if (cached) return cached;
  const newId = `miniuser-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  wx.setStorageSync(key, newId);
  return newId;
}

interface Message {
  role: 'user' | 'bot';
  content: string;
  timestamp?: number;
  timeText?: string;
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diff = now.getTime() - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  // 补零函数
  const padZero = (n: number): string => {
    return n < 10 ? '0' + n : '' + n;
  };
  
  if (minutes < 1) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (msgDate.getTime() === today.getTime()) {
    // 今天
    const hours = date.getHours();
    const mins = date.getMinutes();
    return `${padZero(hours)}:${padZero(mins)}`;
  } else {
    // 更早的日期
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const mins = date.getMinutes();
    return `${month}/${day} ${padZero(hours)}:${padZero(mins)}`;
  }
}

Page({
  data: {
    text: '',
    loading: false,
    messages: [] as Message[],
    scrollTop: 0,
    scrollIntoView: '',
    showActionButtons: true, // 是否显示功能按钮
    inputFocus: false, // 输入框焦点状态
  },

  // 滚动防抖定时器
  scrollDebounceTimer: null as number | null,
  // 是否PC端
  isPC: false,

  // 加载历史记录
  loadHistory() {
    try {
      const saved = wx.getStorageSync(MESSAGES_STORAGE_KEY);
      if (saved && Array.isArray(saved) && saved.length > 0) {
        // 更新所有消息的时间显示
        const messagesWithTime = saved.map((msg: Message) => ({
          ...msg,
          timeText: msg.timestamp ? formatTime(msg.timestamp) : ''
        }));
        this.setData({ messages: messagesWithTime });
        // 滚动到底部
        this.scrollToBottom();
      } else {
        // 如果没有历史记录，显示欢迎消息
        const timestamp = Date.now();
        const welcomeMsg: Message = { 
          role: 'bot', 
          content: '已连接，请输入指令。例如：删除 123456；或重置对话。',
          timestamp,
          timeText: formatTime(timestamp)
        };
        this.setData({ messages: [welcomeMsg] });
        this.saveHistory();
      }
    } catch (err) {
      console.error('加载历史记录失败:', err);
      const timestamp = Date.now();
      const welcomeMsg: Message = { 
        role: 'bot', 
        content: '已连接，请输入指令。例如：删除 123456；或重置对话。',
        timestamp,
        timeText: formatTime(timestamp)
      };
      this.setData({ messages: [welcomeMsg] });
    }
  },

  // 保存历史记录
  saveHistory() {
    try {
      wx.setStorageSync(MESSAGES_STORAGE_KEY, this.data.messages);
    } catch (err) {
      console.error('保存历史记录失败:', err);
      // 如果存储空间不足，尝试清理旧消息并重试
      const error = err as WechatMiniprogram.GeneralCallbackResult;
      if (error && error.errMsg && error.errMsg.includes('exceed')) {
        this.clearOldMessages();
        // 重试保存
        try {
          wx.setStorageSync(MESSAGES_STORAGE_KEY, this.data.messages);
        } catch (retryErr) {
          console.error('重试保存失败:', retryErr);
        }
      }
    }
  },

  // 清理旧消息（保留最近N条）
  clearOldMessages() {
    const messages = this.data.messages;
    if (messages.length > MAX_MESSAGE_COUNT) {
      const recentMessages = messages.slice(-MAX_MESSAGE_COUNT);
      this.setData({ messages: recentMessages });
      try {
        wx.setStorageSync(MESSAGES_STORAGE_KEY, recentMessages);
      } catch (err) {
        console.error('清理后保存失败:', err);
      }
    }
  },

  // 滚动到底部（防抖优化）
  scrollToBottom(immediate = false) {
    const messages = this.data.messages;
    if (messages.length === 0) return;
    
    // 清除之前的防抖定时器
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
    
    // 立即执行或防抖执行
    const executeScroll = () => {
      const lastIndex = messages.length - 1;
      
      // 方法1: 使用 scrollIntoView 定位到最后一条消息
      this.setData({
        scrollIntoView: `msg-${lastIndex}`,
        scrollTop: 0 // 先重置
      });
      
      // 方法2: 延迟后查询实际高度并设置 scrollTop
      setTimeout(() => {
        const query = wx.createSelectorQuery().in(this);
        query.select('.messages-wrapper').boundingClientRect((rect: any) => {
          if (rect) {
            const wrapperHeight = rect.height || 0;
            // 设置一个足够大的值确保滚动到底部
            this.setData({
              scrollTop: wrapperHeight + 5000
            });
          }
        });
        query.select('.messages-container').boundingClientRect((rect: any) => {
          if (rect) {
            const containerHeight = rect.height || 0;
            const query2 = wx.createSelectorQuery().in(this);
            query2.select('.messages-wrapper').boundingClientRect((wrapperRect: any) => {
              if (wrapperRect) {
                const wrapperHeight = wrapperRect.height || 0;
                // 计算需要滚动的距离
                const scrollDistance = Math.max(0, wrapperHeight - containerHeight + 100);
                this.setData({
                  scrollTop: scrollDistance
                });
              }
            });
            query2.exec();
          }
        });
        query.exec();
      }, 100);
      
      // 方法3: 备用方案，确保滚动成功
      setTimeout(() => {
        this.setData({
          scrollTop: MAX_SCROLL_TOP,
          scrollIntoView: `msg-${lastIndex}`
        });
      }, 300);
    };
    
    if (immediate) {
      executeScroll();
    } else {
      // 防抖：延迟执行
      this.scrollDebounceTimer = setTimeout(() => {
        executeScroll();
        this.scrollDebounceTimer = null;
      }, SCROLL_DEBOUNCE_DELAY);
    }
  },

  // 滚动事件处理
  onScroll() {
    // 可以在这里记录滚动位置，用于判断是否需要自动滚动
  },

  onInput(e: any) {
    const value = e.detail.value || '';
    const hasText = value.trim().length > 0;
    this.setData({ 
      text: value,
      showActionButtons: !hasText
    });
  },

  // 提取错误消息
  extractErrorMessage(data: any): string {
    try {
      if (data && typeof data === 'object') {
        if (data.error && typeof data.error === 'string') {
          return data.error;
        }
        if (data.message && typeof data.message === 'string') {
          return data.message;
        }
        // 安全地转换为字符串
        try {
          const str = JSON.stringify(data);
          return str.length > 100 ? str.substring(0, 100) + '...' : str;
        } catch (e) {
          return '请求失败：返回数据格式错误';
        }
      }
      if (typeof data === 'string') {
        return data;
      }
      return '请求失败';
    } catch (e) {
      return '请求失败';
    }
  },

  // 处理网络错误
  handleNetworkError(err: WechatMiniprogram.GeneralCallbackResult | any): string {
    try {
      if (!err) {
        return '网络请求失败';
      }
      
      // 如果 err 是字符串
      if (typeof err === 'string') {
        return err;
      }
      
      // 如果 err 有 errMsg 属性
      if (err.errMsg && typeof err.errMsg === 'string') {
        if (err.errMsg.includes('url not in domain list')) {
          return '域名未配置：请在微信公众平台配置服务器域名（例如 https://your-backend-domain.com），或在开发工具中关闭"不校验合法域名"';
        } else if (err.errMsg.includes('fail') || err.errMsg.includes('timeout')) {
          return `请求失败: ${err.errMsg}`;
        }
        return err.errMsg;
      }
      
      // 如果 err 有 message 属性
      if (err.message && typeof err.message === 'string') {
        return err.message;
      }
      
      // 尝试安全转换
      try {
        const str = JSON.stringify(err);
        return str.length > 100 ? str.substring(0, 100) + '...' : str;
      } catch (e) {
        return '网络请求失败';
      }
    } catch (e) {
      return '网络请求失败';
    }
  },

  onInputFocus() {
    // 输入框聚焦时滚动到底部
    this.setData({ inputFocus: true });
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 300);
  },

  onInputBlur() {
    // PC端自动保持焦点，移动端允许失焦
    if (this.isPC) {
      // 延迟恢复焦点，避免与点击发送按钮冲突
      setTimeout(() => {
        this.setData({ inputFocus: true });
      }, 150);
    }
  },

  appendMessage(role: 'user' | 'bot', content: string) {
    const timestamp = Date.now();
    const newMessage: Message = {
      role,
      content,
      timestamp,
      timeText: formatTime(timestamp)
    };
    // 直接添加新消息，不需要重新格式化所有消息的时间
    // 因为历史记录加载时已经格式化过了
    const list = this.data.messages.concat(newMessage);
    this.setData({ messages: list }, () => {
      // 在setData回调中执行滚动，确保DOM已更新
      // 使用防抖滚动，避免频繁调用
      this.scrollToBottom(true); // 立即执行，因为这是新消息
    });
    // 保存历史记录
    this.saveHistory();
  },

  async onSend() {
    const content = (this.data.text || '').trim();
    if (!content || this.data.loading) return;
    this.appendMessage('user', content);
    this.setData({ 
      text: '', 
      loading: true,
      showActionButtons: true,
      inputFocus: true // 保持输入框焦点（PC端）
    });

    const user_id = getUserId();
    wx.request({
      url: `${BASE_URL}${API_PATH}`,
      method: 'POST',
      timeout: REQUEST_TIMEOUT,
      header: { 'Content-Type': 'application/json' },
      data: {
        user_id,
        msg_type: 'text',
        content
      },
      success: (res) => {
        console.log('请求成功:', res);
        const data = res.data as any;
        if (data && data.ok && data.reply && data.reply.content) {
          this.appendMessage('bot', data.reply.content);
          // appendMessage 内部已经处理了滚动，这里延迟一次确保滚动成功
          setTimeout(() => {
            this.scrollToBottom(true);
          }, 300);
        } else {
          const errorMsg = this.extractErrorMessage(data);
          console.error('请求返回错误:', errorMsg, data);
          this.appendMessage('bot', `请求失败: ${errorMsg}`);
          setTimeout(() => {
            this.scrollToBottom(true);
          }, 300);
        }
      },
      fail: (err) => {
        console.error('网络请求失败:', err);
        const errorMsg = this.handleNetworkError(err);
        this.appendMessage('bot', errorMsg);
        setTimeout(() => {
          this.scrollToBottom(true);
        }, 300);
      },
      complete: () => {
        this.setData({ 
          loading: false,
          inputFocus: true // 请求完成后保持输入框焦点（PC端）
        });
      }
    });
  },

  onLoad() {
    try {
      const user_id = getUserId();
      this.setData({ user_id });
      // 检测是否为PC端
      wx.getSystemInfo({
        success: (res) => {
          this.isPC = res.platform === 'devtools' || res.platform === 'windows' || res.platform === 'mac';
        },
        fail: (err) => {
          console.error('获取系统信息失败:', err);
          // 默认设置为非PC端
          this.isPC = false;
        }
      });
      // 加载历史记录
      this.loadHistory();
    } catch (err) {
      console.error('页面加载错误:', err);
      // 即使出错也显示欢迎消息
      const timestamp = Date.now();
      const welcomeMsg: Message = { 
        role: 'bot', 
        content: '已连接，请输入指令。例如：删除 123456；或重置对话。',
        timestamp,
        timeText: formatTime(timestamp)
      };
      this.setData({ messages: [welcomeMsg] });
    }
  },

  onShow() {
    // 页面显示时确保滚动到底部
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 300);
  },

  onReady() {
    // 页面渲染完成后滚动到底部
    setTimeout(() => {
      this.scrollToBottom(true);
    }, 200);
  },

  onUnload() {
    // 清理防抖定时器
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = null;
    }
  },

  // 分享功能
  onShareAppMessage(_options?: WechatMiniprogram.Page.IShareAppMessageOption): WechatMiniprogram.Page.ICustomShareContent | void {
    try {
      return {
        title: '卡密管理系统',
        path: '/pages/chat/index'
      };
    } catch (err) {
      console.error('分享配置错误:', err);
      // 返回默认配置
      return {
        title: '卡密管理系统',
        path: '/pages/chat/index'
      };
    }
  },

  // 分享到朋友圈（可选，需要基础库 2.11.3+）
  onShareTimeline(): WechatMiniprogram.Page.ICustomTimelineContent | void {
    try {
      return {
        title: '卡密管理系统'
      };
    } catch (err) {
      console.error('分享到朋友圈配置错误:', err);
      // 返回默认配置
      return {
        title: '卡密管理系统'
      };
    }
  }
});

