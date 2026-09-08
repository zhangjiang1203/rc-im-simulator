/**
 * 融云 IMLib 客户端封装
 * 基于 @rongcloud/imlib-next SDK（函数式 API，非实例模式）
 *
 * 注意：
 *  - init() 返回 void，所有 API（connect/sendMessage 等）均为顶层导出函数
 *  - 参数字段名是 appkey（小写 k），不是 appKey
 *  - token 可能含私有化导航地址：<realToken>@navHost1;navHost2
 *    → 解析后 navHost 仅取 rongnav 域名传给 navigators，rongcfg 不传
 *  - init 必须在 connect 之前完成，且需要先 destroy 再重新 init
 *  - sendMessage 签名：sendMessage(conversation, message, options)
 *    message 必须是 BaseMessage 子类实例（如 TextMessage）
 */

let RongIMLib = null;
let _initialized = false;
let _isMock = false;
let _savedAppKey = '';

// ── Mock SDK（无真实 AppKey 时使用）────────────────────────────────────────
// Mock 的 API 签名与真实 SDK 保持一致
const mockSDK = {
  init: (config) => {
    console.log('[Mock] init', config);
  },
  destroy: async () => {
    console.log('[Mock] destroy');
  },
  connect: async (token) => {
    console.log('[Mock] connect', token);
    await delay(500);
    return { code: 0, data: { userId: 'mock_user_' + Date.now() } };
  },
  disconnect: async () => {
    console.log('[Mock] disconnect');
  },
  // sendMessage 签名与真实 SDK 一致：sendMessage(conversation, message, options)
  sendMessage: async (conversation, message, options) => {
    console.log('[Mock] sendMessage', { conversation, message, options });
    await delay(300);
    return {
      code: 0,
      data: {
        messageId: 'mock_' + Date.now(),
        messageUId: 'uid_' + Math.random().toString(36).slice(2),
        sentTime: Date.now(),
        content: message?.content,
      },
    };
  },
  joinChatRoom: async (targetId, count) => {
    console.log('[Mock] joinChatRoom', targetId, count);
    await delay(200);
    return { code: 0 };
  },
  quitChatRoom: async (targetId) => {
    console.log('[Mock] quitChatRoom', targetId);
    return { code: 0 };
  },
  setChatRoomEntry: async (targetId, options) => {
    console.log('[Mock] setChatRoomEntry', targetId, options);
    await delay(200);
    return { code: 0 };
  },
  forceSetChatRoomEntry: async (targetId, options) => {
    console.log('[Mock] forceSetChatRoomEntry', targetId, options);
    await delay(200);
    return { code: 0 };
  },
  BaseMessage: class MockBaseMessage {
    constructor(messageType, content, isPersited = true, isCounted = true) {
      this.messageType = messageType;
      this.content = content;
      this.isPersited = isPersited;
      this.isCounted = isCounted;
    }
  },
  TextMessage: class MockTextMessage {
    constructor(content) {
      this.messageType = 'RC:TxtMsg';
      this.content = content;
      this.isPersited = true;
      this.isCounted = true;
    }
  },
  ImageMessage: class MockImageMessage {
    constructor(content) {
      this.messageType = 'RC:ImgMsg';
      this.content = content;
      this.isPersited = true;
      this.isCounted = true;
    }
  },
  InformationNotificationMessage: class MockInfoNtfMessage {
    constructor(content) {
      this.messageType = 'RC:InfoNtf';
      this.content = content;
      this.isPersited = true;
      this.isCounted = false;
    }
  },
  HQVoiceMessage: class MockHQVoiceMessage {
    constructor(content) {
      this.messageType = 'RC:HQVCMsg';
      this.content = content;
      this.isPersited = true;
      this.isCounted = true;
    }
  },
  FileMessage: class MockFileMessage {
    constructor(content) {
      this.messageType = 'RC:FileMsg';
      this.content = content;
      this.isPersited = true;
      this.isCounted = true;
    }
  },
  // 与真实 SDK 一致：注册自定义消息类型，返回消息类构造函数
  registerMessageType: (messageType, isPersited = true, isCounted = true) =>
    class MockCustomMessage {
      constructor(content) {
        this.messageType = messageType;
        this.content = content;
        this.isPersited = isPersited;
        this.isCounted = isCounted;
      }
    },
  addEventListener: () => {},
  removeEventListener: () => {},
  Events: {
    MESSAGES: 'MESSAGES',
    CONNECTING: 'CONNECTING',
    CONNECTED: 'CONNECTED',
    DISCONNECT: 'DISCONNECT',
  },
  ConversationType: { PRIVATE: 1, GROUP: 3, CHATROOM: 4, ULTRA_GROUP: 10 },
};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function isMockMode() { return _isMock; }

// ── 解析 token 中内嵌的导航地址 ───────────────────────────────────────────
// 格式：<realToken>@navHost1;cfgHost2
// 融云私有化部署：rongnav.com 是导航服务器，rongcfg.com 是配置服务器
// navigators 只需要传 rongnav 地址（即第一个 host）
export function parseToken(rawToken) {
  if (!rawToken) return { token: rawToken, navigators: [], navInfo: '' };
  const atIdx = rawToken.lastIndexOf('@');
  if (atIdx === -1) return { token: rawToken, navigators: [], navInfo: '' };

  const realToken = rawToken.slice(0, atIdx);
  const hostPart  = rawToken.slice(atIdx + 1); // "nav1.rongnav.com;cfg1.rongcfg.com"

  const allHosts = hostPart
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  // 只取 rongnav 域名作为 navigators，rongcfg 是 config 服务器不用传
  const navHosts = allHosts.filter(h => h.includes('rongnav'));
  // 如果没有明确 rongnav，取第一个
  const candidates = navHosts.length > 0 ? navHosts : allHosts.slice(0, 1);

  const navigators = candidates.map(h =>
    h.startsWith('http') ? h : `https://${h}`
  );

  return {
    token: realToken,
    navigators,
    navInfo: allHosts.join('; '),
  };
}

// ── 加载真实 SDK ─────────────────────────────────────────────────────────
async function loadSDK() {
  if (RongIMLib) return RongIMLib;
  try {
    RongIMLib = await import('@rongcloud/imlib-next');
    console.log('[RC] SDK loaded, exports:', Object.keys(RongIMLib).filter(k => /^[a-z]/.test(k)).slice(0, 8));
  } catch (e) {
    console.warn('[RC] SDK load failed, using mock:', e.message);
    RongIMLib = mockSDK;
    _isMock = true;
  }
  return RongIMLib;
}

// ── 重置状态（每次 Connect 前调用，确保 init 可重新执行） ─────────────────
function resetState() {
  _initialized = false;
  // destroy 后 SDK 内部消息注册表会被清空，缓存的构造函数需重新注册
  for (const key of Object.keys(_customMessageClasses)) delete _customMessageClasses[key];
}

// ── 自定义消息类缓存：messageType → registerMessageType 返回的构造函数 ───
const _customMessageClasses = {};

// ── 消息类映射表 ─────────────────────────────────────────────────────────
// 融云消息类型 → SDK Message Class 映射
const MESSAGE_CLASS_MAP = {
  'RC:TxtMsg':   'TextMessage',
  'RC:ImgMsg':   'ImageMessage',
  'RC:InfoNtf':  'InformationNotificationMessage',
  'RC:HQVCMsg':  'HQVoiceMessage',
  'RC:FileMsg':  'FileMessage',
};

// ── 一步完成：解析 token → destroy → init（含 navigators）→ connect ──────
export async function initAndConnect({ appKey, rawToken, navServer, fileServer, environment }) {
  const SDK = await loadSDK();
  _isMock = SDK === mockSDK;

  // ★ 关键修复：重新初始化前先 destroy，否则第二次 init 可能不生效
  if (!_isMock && _initialized) {
    try {
      console.log('[RC] destroying previous instance before re-init...');
      await SDK.destroy();
      console.log('[RC] previous instance destroyed');
    } catch (e) {
      console.warn('[RC] destroy error (ignored):', e.message);
    }
    resetState();
  }

  // navInfo 仅用于日志/界面展示。★ 关键：连接时必须使用「完整原始 token」
  // （含 @em38.cn.rongnav.com;...cfg.com 后缀），SDK 会自行解析其中的导航地址。
  // 若把后缀剥离、改用手动 navigators + environment:'private'，导航服务器
  // 会返回 "original decode failure" → connect code=31004。
  const { navInfo } = parseToken(rawToken);

  _savedAppKey = appKey;

  // 构造 init 参数：默认仅传 appkey，让 SDK 从 token 中解析导航地址。
  const initConfig = { appkey: appKey };
  // 仅当用户「显式」手动填写 navServer 时才覆盖导航地址（自定义/调试用途）。
  if (navServer && navServer.trim()) {
    initConfig.navigators = navServer.split(/[,;]/).map(s => s.trim()).filter(Boolean)
      .map(h => h.startsWith('http') ? h : `https://${h}`);
  }
  // fileServer → uploadDomain（对齐 SDK IInitOption 字段名）
  if (fileServer && fileServer.trim()) initConfig.uploadDomain = fileServer;
  // environment 仅在调用方显式传入时才设置，避免误判私有化导致握手失败。
  if (environment && environment !== 'private') initConfig.environment = environment;

  console.log('[RC] init config:', {
    appkey: appKey,
    navigators: initConfig.navigators,
    uploadDomain: initConfig.uploadDomain,
    environment: initConfig.environment,
  });

  // 每次连接都重新 init（确保配置生效）
  SDK.init(initConfig);
  _initialized = true;

  console.log('[RC] connecting with full token:', rawToken.slice(0, 24) + '...', navInfo ? `(nav: ${navInfo})` : '');

  // ★ 传入完整原始 token（不剥离 @nav 后缀）
  const result = await SDK.connect(rawToken);
  return result;
}

// ── 兼容旧接口（供 ConfigPanel 调用） ────────────────────────────────────
export async function initRCClientFull({ appKey, navServer, fileServer, environment }) {
  // 不再单独初始化，等到 connectRC 时一起处理
  _savedAppKey = appKey;
  const SDK = await loadSDK();
  _isMock = SDK === mockSDK;
  console.log('[RC] initRCClientFull: appKey saved, init deferred to connect. Mock mode:', _isMock);
  return { mock: _isMock };
}

export async function connectRC(rawToken, { navServer, fileServer, environment } = {}) {
  return initAndConnect({
    appKey: _savedAppKey,
    rawToken,
    navServer,
    fileServer,
    environment,
  });
}

// ── 断开连接 ─────────────────────────────────────────────────────────────
export async function disconnectRC() {
  const SDK = await loadSDK();
  try {
    await SDK.disconnect();
  } catch (e) {
    console.warn('[RC] disconnect error:', e.message);
  }
  // ★ 修复：无论 disconnect 成功与否，都尝试 destroy 并重置状态
  if (!_isMock) {
    try {
      await SDK.destroy();
      console.log('[RC] destroyed after disconnect');
    } catch (e) {
      console.warn('[RC] destroy after disconnect error:', e.message);
    }
  }
  resetState();
}

// ── 加入聊天室 ───────────────────────────────────────────────────────────
export async function joinChatRoom(targetId, count = 50) {
  const SDK = await loadSDK();
  // ★ 关键修复：SDK 签名为 joinChatRoom(roomId, options)，第二参数是
  // IChatroomJoinOpts 对象 { count, extra? }（count 有效值 [-1, 50]），
  // 不是数字。直接传数字会被当作非法 options → 错误码 34232。
  return await SDK.joinChatRoom(targetId, { count });
}

// ── 退出聊天室 ───────────────────────────────────────────────────────────
export async function quitChatRoom(targetId) {
  const SDK = await loadSDK();
  return await SDK.quitChatRoom(targetId);
}

// ── 设置聊天室 KV ────────────────────────────────────────────────────────
// SDK 签名：setChatRoomEntry(targetId, { key, value, isSendNotification?, isAutoDelete?, notificationExtra? })
//   - value 为字符串，最大 4096 字符
//   - force=true 走 forceSetChatRoomEntry（覆盖他人设置的同名 key）
export async function setChatRoomKV({ targetId, key, value, isSendNotification = false, isAutoDelete = false, force = false }) {
  const SDK = await loadSDK();
  const options = { key, value, isSendNotification, isAutoDelete };
  const fn = force ? 'forceSetChatRoomEntry' : 'setChatRoomEntry';
  console.log('[RC] setChatRoomKV:', fn, { targetId, key, value: String(value).slice(0, 200), isSendNotification, isAutoDelete });
  if (!SDK[fn]) return { code: -1, msg: `SDK 不支持 ${fn}` };
  return await SDK[fn](targetId, options);
}

// ── 发送消息 ★ 关键修复 ─────────────────────────────────────────────────
// SDK 签名：sendMessage(conversation, message, options)
//   - conversation: { conversationType, targetId }
//   - message: BaseMessage 子类实例（TextMessage / ImageMessage / ...）
//   - options: 可选发送配置
export async function sendIMMessage({ conversationType, targetId, messageType, content }) {
  const SDK = await loadSDK();

  const conversation = { conversationType, targetId };

  // 根据消息类型创建对应的 SDK Message 实例
  let message;
  const className = MESSAGE_CLASS_MAP[messageType];

  if (className && SDK[className]) {
    // 内置消息类型：使用对应 Class 构造
    message = new SDK[className](content);
  } else {
    // 自定义消息类型（如 app:GiftMsg）：必须先 registerMessageType 注册，
    // 否则 engine 层校验发现类型不在注册表 → 34021 MESSAGE_NOT_REGISTERED。
    // registerMessageType 返回消息类构造函数，缓存避免重复注册。
    if (!_customMessageClasses[messageType]) {
      const isPersited = true;
      const isCounted = messageType === 'RC:InfoNtf' ? false : true;
      _customMessageClasses[messageType] = SDK.registerMessageType(messageType, isPersited, isCounted);
    }
    message = new _customMessageClasses[messageType](content);
  }

  console.log('[RC] sendMessage:', {
    conversation,
    messageType: message.messageType,
    content: JSON.stringify(content).slice(0, 200),
  });

  const result = await SDK.sendMessage(conversation, message);
  return result;
}

// ── 消息监听 ─────────────────────────────────────────────────────────────
export async function addMessageListener(callback) {
  const SDK = await loadSDK();
  if (SDK.addEventListener && SDK.Events) {
    SDK.addEventListener(SDK.Events.MESSAGES, callback);
  }
}

export async function getSDK() {
  return loadSDK();
}

// ── 获取连接状态 ─────────────────────────────────────────────────────────
export async function getConnectionStatus() {
  const SDK = await loadSDK();
  if (SDK.getConnectionStatus) {
    return SDK.getConnectionStatus();
  }
  return null;
}
