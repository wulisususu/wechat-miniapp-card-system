import { request } from '../../services/request';

const API_PATH = '/api/wechat/message';
const MESSAGES_STORAGE_KEY = 'chat_messages_history';
const USER_ID_STORAGE_KEY = 'chat_user_id';
const MAX_MESSAGE_COUNT = 100;

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: number;
  timeText: string;
}

function getUserId(): string {
  const cached = wx.getStorageSync(USER_ID_STORAGE_KEY);
  if (cached) return cached;
  const id = `miniuser-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  wx.setStorageSync(USER_ID_STORAGE_KEY, id);
  return id;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function makeMessage(role: 'user' | 'bot', content: string, timestamp = Date.now()): Message {
  return {
    id: `msg-${timestamp}-${Math.random().toString(16).slice(2, 7)}`,
    role,
    content,
    timestamp,
    timeText: formatTime(timestamp)
  };
}

Page({
  data: {
    text: '',
    loading: false,
    messages: [] as Message[],
    scrollIntoView: '',
    animateScroll: false,
    inputFocus: false
  },

  isPC: false,

  onLoad() {
    try {
      const info = wx.getSystemInfoSync();
      this.isPC = info.platform === 'devtools' || info.platform === 'windows' || info.platform === 'mac';
    } catch (_err) {
      this.isPC = false;
    }
    getUserId();
    this.loadHistory();
  },

  onShow() {
    this.scrollToBottom(false);
  },

  loadHistory() {
    let messages: Message[] = [];
    try {
      const saved = wx.getStorageSync(MESSAGES_STORAGE_KEY);
      if (Array.isArray(saved) && saved.length) {
        messages = saved.slice(-MAX_MESSAGE_COUNT).map((item: any, index: number) => {
          const timestamp = Number(item.timestamp || Date.now() + index);
          return {
            id: item.id || `history-${timestamp}-${index}`,
            role: item.role === 'user' ? 'user' : 'bot',
            content: String(item.content || ''),
            timestamp,
            timeText: formatTime(timestamp)
          } as Message;
        });
      }
    } catch (err) {
      console.error('加载历史记录失败:', err);
    }

    if (!messages.length) {
      messages = [makeMessage('bot', '已连接激活码服务。直接输入指令即可。')];
    }

    this.setData({ messages, animateScroll: false }, () => {
      this.scrollToBottom(false);
      this.saveHistory();
    });
  },

  saveHistory() {
    const list = this.data.messages.slice(-MAX_MESSAGE_COUNT);
    try {
      wx.setStorageSync(MESSAGES_STORAGE_KEY, list);
    } catch (err) {
      console.error('保存历史记录失败:', err);
    }
  },

  scrollToBottom(animated = true) {
    const messages = this.data.messages;
    if (!messages.length) return;
    const lastId = messages[messages.length - 1].id;
    wx.nextTick(() => {
      this.setData({ scrollIntoView: lastId, animateScroll: animated });
    });
  },

  appendMessage(role: 'user' | 'bot', content: string) {
    const list = this.data.messages.concat(makeMessage(role, content)).slice(-MAX_MESSAGE_COUNT);
    this.setData({ messages: list }, () => {
      this.saveHistory();
      this.scrollToBottom(true);
    });
  },

  onInput(e: any) {
    this.setData({ text: e.detail.value || '' });
  },

  onInputFocus() {
    this.setData({ inputFocus: true });
    this.scrollToBottom(false);
  },

  onInputBlur() {
    if (!this.isPC) this.setData({ inputFocus: false });
  },

  async onSend() {
    const content = (this.data.text || '').trim();
    if (!content || this.data.loading) return;

    const nextMessages = this.data.messages.concat(makeMessage('user', content)).slice(-MAX_MESSAGE_COUNT);
    this.setData({
      messages: nextMessages,
      text: '',
      loading: true,
      inputFocus: this.isPC
    }, () => {
      this.saveHistory();
      this.scrollToBottom(true);
    });

    try {
      const data = await request<any>(API_PATH, {
        method: 'POST',
        data: {
          user_id: getUserId(),
          msg_type: 'text',
          content
        }
      });

      if (data && data.ok && data.reply && data.reply.content) {
        this.appendMessage('bot', String(data.reply.content));
      } else {
        const message = (data && (data.error || data.message)) || '返回数据格式异常';
        this.appendMessage('bot', `请求失败：${message}`);
      }
    } catch (err: any) {
      const message = err && err.message ? err.message : '网络请求失败';
      this.appendMessage('bot', message.includes('url not in domain list') ? '域名未配置，请检查微信公众平台 request 合法域名设置。' : `请求失败：${message}`);
    } finally {
      this.setData({ loading: false, inputFocus: this.isPC });
    }
  },

  onUnload() {
    this.saveHistory();
  },

  onShareAppMessage() {
    return { title: '激活码服务', path: '/pages/chat/index' };
  },

  onShareTimeline() {
    return { title: '激活码服务' };
  }
});
