/**
 * 融云消息类型及内容模板
 */

const DEFAULT_TEXT_MESSAGE_USER = {
  id: '1300000077',
  name: 'wolaile',
  portrait: 'https://img.hektarapp.io/orj360/4d7c6d4dla1idywe65uvvj20j60j60tw.jpg',
};

const DEFAULT_TEXT_MESSAGE_EXTRA = {
  ts: 1788264947027,
  level: 30,
  user_decorator: {
    entry_notice_id: 30003,
    skin_id: 0,
    profile_background_id: 20010,
    avatar_frame_id: 0,
    profile_background_config: { rank_num: 0, end_time: 1790801999999 },
    little_badge: [
      { display_position_mask: '0', end_time: 4070880000000, replace_fields: ['12'], little_badge_id: 40025 },
      { end_time: 4070880000000, display_position_mask: '0', replace_fields: ['12'], little_badge_id: 40034 },
    ],
    entry_notice_config: { end_time: 4070880000000, rank_num: 0 },
    mask_man_skin_config: { hide_in_live: 0, hide_rank: 0 },
    mask_man_skin_id: '1',
    little_badge_v2: [
      { replace_fields: ['12'], end_time: 4070880000000, display_position_mask: '0', little_badge_id: 40025 },
      { replace_fields: ['12'], end_time: 4070880000000, little_badge_id: 40034, display_position_mask: '0' },
      { display_position_mask: '0', end_time: 1788325872499, little_badge_id: 41004, replace_fields: ['12'] },
    ],
  },
  hostUid: '1300000139',
  badge_list: [2, 4],
};

export const MESSAGE_TYPES = [
  {
    label: '文本消息',
    value: 'RC:TxtMsg',
    icon: '💬',
    fields: [
      { key: 'content', label: '消息内容', type: 'textarea', required: true, placeholder: '请输入文本内容...' },
      { key: 'user', label: '用户信息 (user)', type: 'textarea', required: false, isJson: true, placeholder: '{"id":"..."}' },
      { key: 'extra', label: '扩展信息 (extra)', type: 'textarea', required: false, isJson: true, placeholder: '{"ts":...}' },
    ],
    defaultValues: {
      user: JSON.stringify(DEFAULT_TEXT_MESSAGE_USER, null, 2),
      extra: JSON.stringify(DEFAULT_TEXT_MESSAGE_EXTRA, null, 2),
    },
    buildContent: (values) => ({
      content: values.content || '',
      user: JSON.parse(values.user || JSON.stringify(DEFAULT_TEXT_MESSAGE_USER)),
      extra: values.extra || JSON.stringify(DEFAULT_TEXT_MESSAGE_EXTRA),
    }),
  },
  {
    label: '图片消息',
    value: 'RC:ImgMsg',
    icon: '🖼️',
    fields: [
      { key: 'content', label: '图片URL', type: 'text', required: true, placeholder: 'https://example.com/image.jpg' },
      { key: 'imageUri', label: '原图URL', type: 'text', required: false, placeholder: '原图地址（可选）' },
      { key: 'extra', label: '扩展信息', type: 'text', required: false, placeholder: '可选' },
    ],
    buildContent: (values) => ({
      content: values.content || '',
      imageUri: values.imageUri || values.content || '',
      extra: values.extra || '',
    }),
  },
  {
    label: '自定义消息',
    value: 'custom',
    icon: '⚙️',
    fields: [
      { key: 'customType', label: '自定义消息类型', type: 'text', required: true, placeholder: '如：app:CustomMsg' },
      { key: 'contentJson', label: '消息内容 (JSON)', type: 'textarea', required: true, placeholder: '{"key":"value"}' },
    ],
    buildContent: (values) => {
      try {
        return JSON.parse(values.contentJson || '{}');
      } catch {
        return { raw: values.contentJson };
      }
    },
    getMessageType: (values) => values.customType,
  },
  {
    label: '通知消息 (RC:InfoNtf)',
    value: 'RC:InfoNtf',
    icon: '📢',
    fields: [
      { key: 'message', label: '通知内容', type: 'textarea', required: true, placeholder: '通知消息内容' },
      { key: 'extra', label: '扩展信息', type: 'text', required: false, placeholder: '可选' },
    ],
    buildContent: (values) => ({
      message: values.message || '',
      extra: values.extra || '',
    }),
  },
  {
    label: '高质量语音 (RC:HQVCMsg)',
    value: 'RC:HQVCMsg',
    icon: '🎤',
    fields: [
      { key: 'remoteUrl', label: '语音URL', type: 'text', required: true, placeholder: 'https://example.com/voice.aac' },
      { key: 'duration', label: '时长（秒）', type: 'number', required: true, placeholder: '如: 5' },
      { key: 'extra', label: '扩展信息', type: 'text', required: false, placeholder: '可选' },
    ],
    buildContent: (values) => ({
      remoteUrl: values.remoteUrl || '',
      duration: parseInt(values.duration) || 0,
      extra: values.extra || '',
    }),
  },
  {
    label: '文件消息 (RC:FileMsg)',
    value: 'RC:FileMsg',
    icon: '📎',
    fields: [
      { key: 'name', label: '文件名', type: 'text', required: true, placeholder: '文件名.pdf' },
      { key: 'fileUrl', label: '文件URL', type: 'text', required: true, placeholder: 'https://example.com/file.pdf' },
      { key: 'size', label: '文件大小（字节）', type: 'number', required: false, placeholder: '如: 1024' },
      { key: 'type', label: '文件类型', type: 'text', required: false, placeholder: '如: application/pdf' },
      { key: 'extra', label: '扩展信息', type: 'text', required: false, placeholder: '可选' },
    ],
    buildContent: (values) => ({
      name: values.name || '',
      fileUrl: values.fileUrl || '',
      size: parseInt(values.size) || 0,
      type: values.type || '',
      extra: values.extra || '',
    }),
  },
];

// ★ value 必须与 SDK ConversationType 枚举一致：
//   PRIVATE=1, GROUP=3, CHATROOM=4, ULTRA_GROUP=10
// 之前聊天室误用 10（实际是 ULTRA_GROUP），导致聊天室消息以超级群类型下发 → 错误码 24401。
export const CONVERSATION_TYPES = [
  { label: '聊天室', value: 4, icon: '🏠', desc: '适用于直播、群聊场景' },
  { label: '私聊', value: 1, icon: '👤', desc: '一对一私信' },
  { label: '群组', value: 3, icon: '👥', desc: '群组消息' },
  { label: '超级群', value: 10, icon: '🌐', desc: '超大规模群组' },
];

export const QUICK_TEMPLATES = [
  { label: '欢迎消息', type: 'RC:TxtMsg', content: { content: '欢迎加入直播间！🎉', extra: '' } },
  { label: '系统通知', type: 'RC:InfoNtf', content: { message: '系统消息：直播即将开始，请做好准备', extra: '' } },
  { label: '送礼通知', type: 'custom', customType: 'app:GiftMsg', content: { userId: 'user123', giftName: '火箭', count: 1, ts: Date.now() } },
  { label: '弹幕消息', type: 'custom', customType: 'app:BarrageMsg', content: { text: '主播好棒！', color: '#FF6B6B', size: 16 } },
  { label: '点赞消息', type: 'custom', customType: 'app:LikeMsg', content: { userId: 'user456', count: 10 } },
];
