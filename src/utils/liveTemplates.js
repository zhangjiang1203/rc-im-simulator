/**
 * 直播间 IM 消息 & 聊天室 KV 模板
 *
 * 依据对 live-iOS 源码的完整审计生成（2026-08-19 校对版）：
 *  - IM: live/Modules/Live/LiveIm/LiveImDefine.swift（LiveMessageType 及各 sub_type 枚举）
 *        + live/Modules/Live/LiveIm/message/LiveContentMessage.swift（20+ 消息子类字段）
 *        + live/Modules/Live/LiveIm/message/LiveMessageUtils.swift（type/sub_type 工厂映射）
 *  - KV: live/Modules/Live/LiveIm/LiveImDefine.swift 的 `LiveChatRoomKVKey`（共 43 个 key，
 *        早期文档写的“53 个”不准确）+ LiveMessageViewModel+KV.swift 逐 key 的 HandyJSON 模型。
 *
 * 未建模的 3 个保留/未使用 KV key（声明了常量但仓库内找不到任何生产代码消费，故不生成模板，
 * 避免用空壳模板误导测试）：`client_info` / `platform_box_click` / `mask`（KV，注意与 IM 的
 * `type:"mask"` 神秘人消息是两个不同的命名空间）。
 *
 * 两类下发通道：
 *  1. IM 消息（channel: 'im'）——通过融云聊天室消息下发
 *     - Live:Custom：业务自定义消息壳，真正分类在内部 JSON 的 type/sub_type
 *       实际 content 结构为 { content: "<内层JSON字符串>", extra: "" }
 *       为方便编辑，编辑器里直接展示【内层 payload】{type,sub_type,unique_id,extra}
 *       发送时由 buildIMContent 自动包一层（wrapAsLiveCustom=true）。
 *     - Live:BulletComment / Level:LevelBoxComment：字段直接平铺在 content 上。
 *  2. KV 消息（channel: 'kv'）——通过 setChatRoomEntry(targetId,{key,value}) 下发
 *     - value 为 JSON 字符串，编辑器展示其对象结构，发送时 JSON.stringify。
 */

// ── 直播间 IM 消息模板 ──────────────────────────────────────────────
// 每项：{ id, group, label, objectName, wrapAsLiveCustom, subTypeHint, template }
export const LIVE_IM_TEMPLATES = [
  // —— 通知上屏 notice ——
  {
    id: 'im-notice-join',
    group: '通知 notice',
    label: '观众进场 (notice/join)',
    objectName: 'Live:Custom',
    wrapAsLiveCustom: true,
    subTypeHint: '1 进场 / 2 后台消息 / 3 审核警告 / 4 关注 / 5 分享 / 7 心愿达成 / 8 小时榜 / 9 日榜 / 12 PK恶意退出警告 / 13 升级 / 14 礼花 / 15 Toast / 16 Event直播alert / 17 回溯状态 / 18 送礼引导 / 19 高并发 / 20 布局变更 / 21 电商浏览人数 / 22 电商购买人数 / 23 用户排名等级变化',
    template: {
      type: 'notice', sub_type: 1,
      extra: {
        uid: '1000426478',
        decorator: { animation_duration: 5000, level: 70, badge_list: [3, 4] },
        is_pre_supporter: false,
        user_decorator: {
          mask_man_skin_id: 1,
          mask_man_skin_config: { hide_rank: 0, hide_in_live: 0 },
          skin_id: 0,
          avatar_frame_id: 10005,
          avatar_frame_config: { rank_num: 0, end_time: 4070880000000, display_position_mask: 1830 },
          profile_background_id: 20005,
          entry_notice_id: 30011,
          spl_fans_id: 0,
          spl_fans_config: { level: 0, hide: '', scheme: '', club_num: 0, user_top: 0, name_en: '', name_ar: '' },
          profile_background_config: { end_time: 4070880000000, display_position_mask: 524287 },
          entry_notice_config: { end_time: 4070880000000, display_position_mask: 524287 },
          little_badge: [{ little_badge_id: 40032, end_time: 1790801999882, replace_fields: [], display_position_mask: 0 }],
        },
        name_ar: 'Helloworld',
        name: 'Helloworld',
        avatar: 'https://img.hektarapp.io/orj360/3ba14beela1idywfnik30j20m80m8dhj.jpg',
        vip: {
          creator: 0,
          badge_list: [3, 4],
          background_colors: ['#414C82', '#514873'],
          animation_duration: 5000,
          level: 70,
          level_background_colors: ['#414C82', '#6E62A2'],
          level_colors: ['#FFECAB', '#DAC478'],
          border_colors: ['#E5F9FF', '#98C0DD', '#D0D9FF', '#8CCFDB'],
          text_color: '#FFFFFF',
        },
      },
      jim_test_user: false,
    },
  },
  {
    id: 'im-notice-follow',
    group: '通知 notice',
    label: '直播间关注 (notice/follow)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'notice', sub_type: 4, unique_id: 'notice_4', extra: { uid: '10002', name: 'Bob', name_ar: 'بوب', avatar: '', enMessage: 'followed the host', arMessage: '', current_lid: '30001' } },
  },
  {
    id: 'im-notice-giftguidance',
    group: '通知 notice',
    label: '送礼引导 (notice/giftGuidance/18)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'notice', sub_type: 18, unique_id: 'notice_18',
      extra: {
        current_lid: '30001', guideType: 1, lid: '30001', uid: '10001', giftId: '888',
        giftPicUri: 'https://example.com/gift.png', popupEnglishText: 'Send a gift to support!',
        popupArabicText: 'أرسل هدية للدعم!', popupDuration: 5000, coin: 100, isDynamicGift: 0, requestId: 'req_1',
      },
    },
  },
  {
    id: 'im-notice-highconcurrency',
    group: '通知 notice',
    label: '高并发消息 (notice/highConcurrency/19)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'notice', sub_type: 19, unique_id: 'notice_19', extra: { current_lid: '30001', lid: '30001', scene: 1, maxTime: 3, params: '{}' } },
  },
  // —— 平台 platform ——
  {
    id: 'im-platform-lamp',
    group: '平台 platform',
    label: '跑马灯通道 (platform/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 跑马灯通道 / 3 礼物上新',
    template: {
      type: 'platform', sub_type: 1, unique_id: 'plat_1',
      extra: {
        list: [{
          platform_type: '1', platform_uid: '', channel_type: 2, luckybox_bus_type: '0',
          lid: '30001', avatar: 'https://example.com/a.png', level: 10, user_decorator: { skin_id: 12 },
          user_rank: '1', gift_uid: '10001', gift_id: '888', box_uid: '', box_pic: '', pic1: '', pic2: '',
          enMessage: 'sent a Rocket!', arMessage: '', full_supporter_en_message: '', full_supporter_ar_message: '',
          rank: '1', forbid_event_broadcast: false, room_broadcast: true,
        }],
      },
    },
  },
  {
    id: 'im-platform-giftnew',
    group: '平台 platform',
    label: '礼物上新 (platform/3)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'platform', sub_type: 3, unique_id: 'plat_3', extra: { gift_id: '888', type: 1, only_anchor: false } },
  },
  // —— 点赞 like ——
  {
    id: 'im-like',
    group: '点赞 like',
    label: '点赞 (like)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'like', sub_type: 0, unique_id: 'like_1', extra: { uid: '10001', name: 'Alice', name_ar: '', count: 10, animation_type: 0 } },
  },
  // —— 送礼 gift ——
  {
    id: 'im-gift-normal',
    group: '礼物 gift',
    label: '普通礼物 (gift/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 普通礼物 / 2 全屏礼物 / 3 AR 礼物',
    template: {
      type: 'gift', sub_type: 1, unique_id: 'gift_1',
      extra: {
        uid: '10001', name: 'Alice', name_ar: '', avatar: 'https://example.com/a.png',
        giftId: '888', count: 1, price: 100, level: 12, badge_list: [1, 2],
        to_uid: '20001', to_name: 'Host', to_name_ar: '',
        gift_aggregate_num: 0, gift_aggregate_total_price: 0, expand: 0,
        naming_right: 0, first_gift: 0, comb_size: 0, comb_count: 0,
        star_wish_score: 0, activity_id: 0,
        user_decorator: { mask_man_skin_id: '0', skin_id: 12 },
      },
    },
  },
  {
    id: 'im-gift-fullscreen',
    group: '礼物 gift',
    label: '全屏礼物 (gift/2)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'gift', sub_type: 2, unique_id: 'gift_2',
      extra: {
        uid: '10001', name: 'Alice', name_ar: '', avatar: '', giftId: '999', count: 1, price: 5000, level: 30,
        badge_list: [1, 2, 3], to_uid: '20001', to_name: 'Host', gift_aggregate_num: 0,
        gift_aggregate_total_price: 0, first_gift: 0, user_decorator: {},
      },
    },
  },
  {
    id: 'im-gift-ar',
    group: '礼物 gift',
    label: 'AR 礼物 (gift/3)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'gift', sub_type: 3, unique_id: 'gift_3',
      extra: { uid: '10001', name: 'Alice', giftId: '1001', count: 1, price: 8000, level: 35, badge_list: [1], to_uid: '20001', to_name: 'Host', gift_aggregate_num: 0, gift_aggregate_total_price: 0 },
    },
  },
  // —— 连麦/跨房/PK connect ——
  {
    id: 'im-connect-invite',
    group: '连麦/跨房/PK connect',
    label: '主播邀请连麦 (connect/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 邀请 / 2 拒绝 / 3 同意 / 4 取消 / 5 踢出 / 6 全体下麦 / 7 闭麦 / 8 取消闭麦 / 9 跨房邀请 / 10 取消跨房邀请 / 11 拒绝跨房邀请 / 12 随机PK失败 / 13 随机PK成功 / 14 PK邀请 / 15 同意PK / 16 拒绝PK / 17 取消PK邀请 / 18 多人跨房邀请 / 19 同意跨房 / 20 取消PK',
    template: { type: 'connect', sub_type: 1, unique_id: 'conn_1', extra: { uid: '10001', name: 'Alice', nickname: 'Alice', username: 'alice', imageUrl: '', imageUrls: [], lid: '30001', current_lid: '30005', biz: 0 } },
  },
  {
    id: 'im-connect-invite-cross',
    group: '连麦/跨房/PK connect',
    label: '收到跨房邀请 (connect/9)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'connect', sub_type: 9, unique_id: 'conn_9',
      extra: {
        uid: '10008', name: 'CrossHost', imageUrl: '', lid: '30008', current_lid: '30001',
        game_id: 'g-1', plan_lids: '30008,30009', contacted_live_count: 2, contacted_live_uids: ['10008', '10009'],
        pk_type: 1, biz: 0,
      },
    },
  },
  {
    id: 'im-connect-pkinvite',
    group: '连麦/跨房/PK connect',
    label: '收到 PK 邀请 (connect/14)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'connect', sub_type: 14, unique_id: 'conn_14',
      extra: {
        uid: '10005', name: 'Rival', nickname: 'Rival', imageUrl: '', lid: '30005', current_lid: '30001',
        pk_id: 'pk_20260716_01', pk_type: 1, pk_mode: 1, invite_key: 'inv_key_01',
        people_count: '1200', heat_power: '8888', badge_codes: [1, 4],
        tier_info: { tier: 3, star: 2, is_peak: 0, peak_rank: 0, progress: 60, score: 1500, progress_max: 100 },
        custom_pk_config: { custom_pk: false, pk_rule_en: ['5 min', 'gifts + likes x3'], pk_rule_ar: [], pk_time: 300, allow_props_card: 1, allow_auto_bonus: 1, allow_like: 1, allow_gift: 1, pk_gift_id: '0' },
      },
    },
  },
  // —— 排位赛 pk_league ——
  {
    id: 'im-pkleague-weakbuffer',
    group: '排位赛 pk_league',
    label: '弱者加成 (pk_league/weakBuffer/10)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 赛季开始引导 / 2 Ready超时 / 3 匹配超时 / 4 模式切换邀请 / 5 切换撤销 / 6 切换拒绝 / 7 匹配取消 / 8 Ready / 9 UnReady / 10 弱者加成 / 11 连胜提醒 / 12 反超提示 / 13 结算结果 / 14 2v2切换拒绝 / 15 大额打赏',
    template: {
      type: 'pk_league', sub_type: 10, unique_id: 'league_buffer_1',
      extra: {
        lid: '30001', uid: '10001', en_message: 'Weak buff applied', ar_message: '',
        hosts: [{ uid: '10001', nickname: 'Alice', avatar: 'https://example.com/a.png' }],
        percent: 20, score: 300,
      },
    },
  },
  {
    id: 'im-pkleague-settle',
    group: '排位赛 pk_league',
    label: '排位赛结算 (pk_league/settle/13)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: {
      type: 'pk_league', sub_type: 13, unique_id: 'league_settle_1',
      extra: {
        lid: '30001', current_lid: '30001', uid: '10001',
        pk_session_id: 'sess-1', result: 1, save_card_used: false, consecutive_win: 3, score_delta: 120,
        addons: [{ type: 'streak', name_en: 'Win Streak', name_ar: 'سلسلة انتصارات', value: 20 }],
        tier_transitions: [{ change: 'up', tier: 3, star: 1, progress_from: 80, progress_to: 100, progress_max: 100, is_peak: false, score: 1200 }],
      },
    },
  },
  // —— 其他 other ——
  {
    id: 'im-other-kick',
    group: '其他 other',
    label: '主播踢人 (other/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 踢人 / 3 多端踢出 / 4 后台关播 / 5 主播关播 / 6 后台警告退出 / 7 高光 / 8 断播暂停 / 9 混流重试 / 10 混流成功上报',
    template: { type: 'other', sub_type: 1, unique_id: 'other_1', extra: { current_lid: '30001', enMessage: 'You have been removed', arMessage: '', vendor: 1, rtc_push_token: '', type: 'video', platform: 'app', event: '0', uuid: '' } },
  },
  // —— 空事件占位 pk / follow ——
  {
    id: 'im-pk-empty',
    group: '空事件占位 pk/follow',
    label: 'PK 事件占位 (pk)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '该消息类 LivePKMessage 未解析任何字段，extra 可为空对象',
    template: { type: 'pk', sub_type: 0, unique_id: 'pk_1', extra: {} },
  },
  {
    id: 'im-follow-empty',
    group: '空事件占位 pk/follow',
    label: '关注事件占位 (follow)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '该消息类 LiveFollowMessage 未解析任何字段，extra 可为空对象',
    template: { type: 'follow', sub_type: 0, unique_id: 'follow_1', extra: {} },
  },
  // —— 权限 authority ——
  {
    id: 'im-auth-room',
    group: '权限 authority',
    label: '房间权限修改 (authority/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 房间权限 / 2 用户申请 / 3 主播回复 / 4 摄像头 / 5 麦克风 / 6 发言 / 7 管理员',
    template: { type: 'authority', sub_type: 1, unique_id: 'auth_1', extra: { type: 7, current_lid: '30001', value: 1, allow_camera: 1, allow_mirco: 1, uid: '10001', name: 'Alice', name_ar: '' } },
  },
  // —— 戳一戳 challenge ——
  {
    id: 'im-challenge',
    group: '戳一戳 challenge',
    label: '戳一戳申请 (challenge/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 申请 / 2 回复',
    template: { type: 'challenge', sub_type: 1, unique_id: 'chal_1', extra: { uid: '10001', lid: '30001', current_lid: '30001', nickname: 'Alice', username: 'alice', imageUrl: '', badge_codes: [1], enMessage: 'challenge you!', arMessage: '', enButton: 'Accept', arButton: '', options_type: 1, options: [] } },
  },
  // —— 屏蔽词 block ——
  {
    id: 'im-block',
    group: '屏蔽词 block',
    label: '屏蔽关键字 (block)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'block', sub_type: 0, unique_id: 'block_1', extra: { en: 'Keyword blocked', ar: 'تم حظر الكلمة' } },
  },
  // —— 红包 luckybox ——
  {
    id: 'im-luckybox',
    group: '红包 luckybox',
    label: '创建红包成功 (luckybox/4)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 创建(无条件金币) / 3 实物退还 / 4 创建(有条件/实物) / 5 自动开奖',
    template: { type: 'luckybox', sub_type: 4, unique_id: 'box_1', extra: { type: 1, box_id: 'box_20260716', creator_uid: '10001', enMessage: 'sent a red packet', arMessage: '', enMessageNew: 'sent a red packet', arMessageNew: '', boxImageUrl: '' } },
  },
  // —— IM 区通知 notification ——
  {
    id: 'im-notification',
    group: 'IM区通知 notification',
    label: 'IM区通知 (notification/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 全直播间可见 / 2 仅自己可见',
    template: { type: 'notification', sub_type: 1, unique_id: 'ntf_1', extra: { enMessage: 'Official notice', arMessage: '', current_lid: '30001', icon_type: 0, scheme_extra: { en_text: 'Detail', ar_text: '', url: 'https://example.com' } } },
  },
  // —— 神秘人 mask ——
  {
    id: 'im-maskman',
    group: '神秘人 mask',
    label: '神秘人请求 (mask/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 主播发起请求 / 2 神秘人响应 / 3 皮肤剩余时间',
    template: { type: 'mask', sub_type: 1, unique_id: 'mask_1', extra: { mask_uid: 99999, luid: 20001, lid: 30001, opt: 1, real_uid: 10001, remaining_time: 300 } },
  },
  // —— PK 道具 pk_props ——
  {
    id: 'im-pkprops',
    group: 'PK道具 pk_props',
    label: '获取PK道具 (pk_props/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 获取道具 / 2 使用道具 / 100 即将到期(本地)',
    template: { type: 'pk_props', sub_type: 1, unique_id: 'prop_1', extra: { good_id: 'g1', props_type: '1', good_type: '1', good_image: '', good_name: 'Steal Card', good_name_ar: '', unique_id: 'prop_1', current_lid: '30001', lid: '30001', uid: '10001', name: 'Alice', name_ar: '', avatar: '', level: 12, badge_list: [1], user_decorator: {} } },
  },
  // —— 评论区提示 live_tip_text ——
  {
    id: 'im-tiptext',
    group: '评论区提示 live_tip_text',
    label: '评论区提示文案 (live_tip_text)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'live_tip_text', sub_type: 0, unique_id: 'tip_1', extra: { en_msg: 'Please follow the community rules', ar_msg: '', icon: '', type: 0 } },
  },
  // —— 活动通知 activity ——
  {
    id: 'im-activity',
    group: '活动 activity',
    label: '活动通知 (activity)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'activity', sub_type: 0, unique_id: 'act_1', extra: { current_lid: 30001, enMessage: 'Event started', arMessage: '', enClickText: 'Join', arClickText: '', icon: '', type: 0, activity: { activity_type: 1, activity_id: 'a1', name: 'Summer', start_time: 0, end_time: 0, little_cover: '', url: '', common_open_type: 0, needLid: false } } },
  },
  // —— 聊天框PK规则 cross_custom_pk_rule ——
  {
    id: 'im-pkrule',
    group: 'PK规则 cross_custom_pk_rule',
    label: '聊天框PK规则 (cross_custom_pk_rule)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    template: { type: 'cross_custom_pk_rule', sub_type: 0, unique_id: 'pkrule_1', extra: { pk_id: 'pk_20260716_01', pk_rule_en: 'PK Rule: 5 min, gifts + likes×3, cards allowed', pk_rule_ar: '' } },
  },
  // —— 广播 broadcast ——
  {
    id: 'im-broadcast',
    group: '广播 broadcast',
    label: '广播-免费礼物 (broadcast/1)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 免费礼物 / 2 活动引导',
    template: { type: 'broadcast', sub_type: 1, unique_id: 'bc_1', extra: { gift_id: 888 } },
  },
  // —— 电商 ecommerce ——
  {
    id: 'im-ecommerce-explaining',
    group: '电商 ecommerce',
    label: '电商讲解状态 (live_commerce_explaining)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '兼容旧版 type="ecommerce_live" + sub_type=2',
    template: { type: 'live_commerce_explaining', sub_type: 0, unique_id: 'commerce_explain_1', extra: { product_id: 'spu-1', status: 0, version: 3, send_time: 1755600000000 } },
  },
  {
    id: 'im-ecommerce-productinfo',
    group: '电商 ecommerce',
    label: '电商商品库变动 (live_commerce_product_info)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '兼容旧版 type="ecommerce_live" + sub_type=1；change_type: ADD/REMOVE/REORDER',
    template: { type: 'live_commerce_product_info', sub_type: 0, unique_id: 'commerce_product_1', extra: { lid: 30001, change_type: 'ADD' } },
  },
  {
    id: 'im-ecommerce-coupon',
    group: '电商 ecommerce',
    label: '优惠券 (ecommerce_coupon)',
    objectName: 'Live:Custom', wrapAsLiveCustom: true,
    subTypeHint: '1 领券成功弹窗 / 2 券可领取通知',
    template: { type: 'ecommerce_coupon', sub_type: 1, unique_id: 'coupon_1', extra: { trace_id: 'trace-1', coupon_id: 'c-1', coupon_name: '10% off', discount_amount: 10, expire_time: 1758278400000 } },
  },
  // —— 弹幕 Live:BulletComment（字段平铺，非 Live:Custom）——
  {
    id: 'im-bullet',
    group: '弹幕 / 宝箱',
    label: '弹幕评论 (Live:BulletComment)',
    objectName: 'Live:BulletComment',
    wrapAsLiveCustom: false,
    template: { uid: '10001', name: 'Alice', name_ar: 'أليس', avatar: 'https://example.com/a.png', badge_list: [1, 2], level: 12, msg: 'Go go go!', typeId: '1', user_decorator: { skin_id: 12 } },
  },
  // —— 等级宝箱 Level:LevelBoxComment ——
  {
    id: 'im-levelbox',
    group: '弹幕 / 宝箱',
    label: '等级宝箱 (Level:LevelBoxComment)',
    objectName: 'Level:LevelBoxComment',
    wrapAsLiveCustom: false,
    template: { level_box_type: '1', title: 'Level Box', desc: 'Congrats!', amount: '100', box_power_level: '3' },
  },
];

// ── 直播间聊天室 KV 模板 ────────────────────────────────────────────
// 每项：{ id, group, key, label, template, defaults:{force,notify,autoDelete} }
export const LIVE_KV_TEMPLATES = [
  {
    id: 'kv-live_play_counters', group: '计数/基础', key: 'live_play_counters', label: '点赞/观看计数 (live_play_counters)',
    template: { likes_counter: 1200, cu_counter: 560, outside_cu_counter: 60, inside_cu_counter: 500, single_apply_counter: 3, uv_counter: 800 },
  },
  {
    id: 'kv-room_hint', group: '计数/基础', key: 'room_hint', label: '聊天室警示语 (room_hint)',
    template: { en: 'Please keep the room friendly', arab: 'يرجى الحفاظ على أجواء ودية' },
  },
  {
    id: 'kv-live_play_setting', group: '计数/基础', key: 'live_play_setting', label: '权限设置 (live_play_setting)',
    template: { comment_able: 1, allow_camera: 1, allow_mic: 1, bullet_comment_able: 1, guest_request_able: 1, host_request_type: 1, league_invite_setting: 1, allow_challenge: 1, apply_with_question: 0, gift_voice_play_able: 1, allow_gift_received: 1, allow_lucky_box: 1 },
  },
  {
    id: 'kv-live_play_close_camera', group: '计数/基础', key: 'live_play_close_camera', label: '摄像头状态 (live_play_close_camera)',
    template: { close: false, update_in_millis: 1752600000000 },
  },
  {
    id: 'kv-live_highlight', group: '计数/基础', key: 'live_highlight', label: '高光按钮 (live_highlight)',
    template: { record_status: '1' },
  },
  {
    id: 'kv-live_state_notify', group: '计数/基础', key: 'live_state_notify', label: '直播间业务状态 (live_state_notify)',
    template: { live_state: 1, lid: '30001' },
  },
  {
    id: 'kv-live_quality_info', group: '计数/基础', key: 'live_quality_info', label: '主播等级 (live_quality_info)',
    template: { anchor_level: 2, live_recommend_priority: 1 },
  },
  {
    id: 'kv-live_layout_config', group: '计数/基础', key: 'live_layout_config', label: '推流布局配置 (live_layout_config)',
    template: { fps: 20, bitrate: 1800, layout_id: 'layout_01', width: 720, height: 1280, seat_idx: 0 },
  },
  // —— 连麦 ——
  {
    id: 'kv-ask_conn_micro_list', group: '连麦', key: 'ask_conn_micro_list', label: '申请连麦列表 (ask_conn_micro_list)',
    template: { apply: [{ uid: '10001', lid: '30001', nickname: 'Alice', username: 'alice', profile_image_url: '', invited: 1, recommend: '', recommendList: [], heat_power: 800, heat_rank: 1, level: 12, badge_list: [{ code: 1, name: 'Verified', desc: '' }], badges: [1], position: '', guest_count: 0, allow_mirco: true, allow_camera: true, friend: 0, question: 'Can I join?', rank: 1, apply_waiting_time: '0', layout_id: '', seat: 0, avatar: [] }] },
  },
  {
    id: 'kv-live_stream_list', group: '连麦', key: 'live_stream_list', label: '已连麦/流列表 (live_stream_list)',
    template: { ts: 1752600000000, img_template: '', stream_vendor: 1, online: [{ uid: '20001', lid: '30001', user: { uid: '20001', lid: '30001', nickname: 'Host', username: 'host', profile_image_url: '', level: 30, badges: [1], allow_mirco: true, allow_camera: true, heat_power: 800, rank: 1 } }] },
  },
  {
    id: 'kv-live_administrators', group: '连麦', key: 'live_administrators', label: '房管列表 (live_administrators)',
    template: { administrators: ['10001', '10002'], administrators_new: [{ uid: '10001', pin_enable: true }] },
  },
  {
    id: 'kv-connect_gifted', group: '连麦', key: 'connect_gifted', label: '连麦人收礼状态 (connect_gifted)',
    template: { timestamp: 1752600000000, version: 1, map: { 20001: 500 }, curs: [{ rank: 1, uid: '20001', score: 500, timestamp: 1752600000000 }], others: [] },
  },
  // —— PK / 跨房 ——
  {
    id: 'kv-cross_pk_host_info', group: 'PK/跨房', key: 'cross_pk_host_info', label: 'PK主播信息 (cross_pk_host_info)',
    template: {
      pk_id: 'pk_20260716_01', status: 2, pk_type: 1, pk_mode: 1, cross_vendor: 1,
      support_custom_pk: false, custom_pk_config: { pk_time: 300, custom_pk: false, only_like: false, only_gift: false, single_gift: false, gift_id: '0' },
      push_stream_address: '', push_token: '',
      pk_start_time: 1752600000000, pk_end_time: 1752600300000,
      victory_start_time: 0, victory_end_time: 0,
      layout_mode: 1, layout_numbers: [1, 1],
      is_win: 2, straight_win: 0, rival_straight_win: 0,
      ko_win: 0, rival_ko_win: 0, ko_death: false, ko_percentage: 0,
      invite_key: '', pk_results: [{ uid: '20001', is_win: 1 }], pker: 0, group: 0, add_time: 0,
      cross_info: [
        { lid: '30001', uid: 20001, nickname: 'Host', profile_image_url: '', level: 30, badge_list: [], group: 0, pker: 1, score: 0, rank: 0 },
        { lid: '30005', uid: 20005, nickname: 'Rival', profile_image_url: '', level: 28, badge_list: [], group: 1, pker: 1, score: 0, rank: 0 },
      ],
    },
  },
  {
    id: 'kv-cross_pk_reward_coin', group: 'PK/跨房', key: 'cross_pk_reward_coin', label: 'PK双方分数 (cross_pk_reward_coin)',
    template: { pk_id: 'pk_20260716_01', current: 1200, opposite: 800, steal: 0, uid_scores: [{ uid: 20001, score: 1200, rank: 1 }] },
  },
  {
    id: 'kv-cross_pk_reward_info', group: 'PK/跨房', key: 'cross_pk_reward_info', label: 'PK榜三 (cross_pk_reward_info)',
    template: { current: [{ uid: '10001', profile_image_url: '', reward_coin: 500 }], opposite: [{ uid: '10009', profile_image_url: '', reward_coin: 300 }] },
  },
  {
    id: 'kv-cross_pk_bonus_info', group: 'PK/跨房', key: 'cross_pk_bonus_info', label: 'PK加成任务 (cross_pk_bonus_info)',
    template: {
      pk_id: 'pk_20260716_01', status: 1, bonus_times: 2, task_collect_type: 1, task_collect_goal: 1000,
      task_sub_1_start: 1752600000000, task_sub_1_end: 1752600010000,
      task_sub_2_start: 1752600010000, task_sub_2_end: 1752600020000,
      task_sub_3_start: 1752600020000, task_sub_3_end: 1752600030000,
      task_collecting_start: 1752600000000, task_collecting_end: 1752600120000,
      bonus_sub_1_start: 1752600120000, bonus_sub_1_end: 1752600180000,
      bonus_sub_2_start: 1752600180000, bonus_sub_2_end: 1752600240000,
      bonus_collecting_start: 1752600120000, bonus_collecting_end: 1752600240000,
      bonus_coin: 500,
    },
  },
  {
    id: 'kv-cross_pk_bonus_task_collect_current', group: 'PK/跨房', key: 'cross_pk_bonus_task_collect_current', label: 'PK加成进度 (纯数字)', rawValue: true,
    template: 600,
  },
  {
    id: 'kv-cross_pk_auth_info', group: 'PK/跨房', key: 'cross_pk_auth_info', label: 'PK恶意退出限制窗口 (cross_pk_auth_info)',
    template: { start_time: 1752600000, end_time: 1752600600 },
  },
  {
    id: 'kv-multi_pk_extend', group: 'PK/跨房', key: 'multi_pk_extend', label: 'PK扩展-静音 (multi_pk_extend)',
    template: { mute: ['10003'] },
  },
  {
    id: 'kv-pk_props_v2', group: 'PK/跨房', key: 'pk_props_v2', label: 'PK道具卡v2 (pk_props_v2)',
    template: {
      schema_p: ['start_time', 'end_time', 'uid', 'good_id', 'props_type', 'percent', 'effect_rate', 'unique_id'],
      schema_b: ['start', 'end', 'btype'],
      list: [{ lid: '30001', props: { strike: [[1752600000000, 1752600060000, 10001, 701, 2, 30, 500, 9001]] }, buffs: { weak_buffer: [[1752600000000, 1752600300000, 1]] } }],
    },
  },
  {
    id: 'kv-cross_guest_list', group: 'PK/跨房', key: 'cross_guest_list', label: 'Audio跨房选人 (cross_guest_list)',
    template: {
      apply_lid: '30001', img_template: '', status: 1, select_end_time: 1752600060000, max_guest_count: 4,
      current_host: { lid: '30001', user_id: 10001, profile_pid: '', username: 'alice', selected: true, pick_up_status: 0 },
      opposite_host: { lid: '30005', user_id: 10005, profile_pid: '', username: 'rival', selected: true, pick_up_status: 0 },
      current_guests: [{ lid: '30001', user_id: 10001, profile_pid: '', username: 'alice', selected: false, pick_up_status: 0 }],
      opposite_guests: [],
    },
  },
  {
    id: 'kv-cross_invite_list', group: 'PK/跨房', key: 'cross_invite_list', label: '跨房邀请列表 (cross_invite_list)',
    template: { lid: '30001', invite_list: [{ lid: '30005', uid: 20005, nickname: 'Rival', profile_image_url: '', level: 28, badge_list: [], invite_end_time: 1752600060000 }] },
  },
  {
    id: 'kv-cross_custom_pk_rule', group: 'PK/跨房', key: 'cross_custom_pk_rule', label: 'PK规则 (cross_custom_pk_rule)',
    template: { pk_id: 'pk_20260716_01', pk_rule_en: 'PK Rule: 5 min, gifts + likes×3', pk_rule_ar: '' },
  },
  {
    id: 'kv-activity_effect', group: 'PK/跨房', key: 'activity_effect', label: '点赞动效活动配置 (activity_effect)',
    template: { like_effect_id: 1 },
  },
  // —— 排位赛 League ——
  {
    id: 'kv-pk_league_info', group: '排位赛 League', key: 'pk_league_info', label: 'PK排位赛状态 (pk_league_info)',
    template: {
      pl_state: 4, lid: '30001', uid: '10001',
      schema_t: ['team_id', 'is_peak', 'tier', 'star', 'score', 'peak_rank'],
      lg_info_t: [['teamA', 0, 3, 2, 1500, 0], ['teamB', 0, 3, 1, 1400, 0]],
      schema_l: ['uid', 'lid', 'nickname', 'u_pid', 'team_id', 'is_peak', 'tier', 'star', 'score', 'peak_rank'],
      lg_info_l: [['10001', '30001', 'HostA', 'pid_a', 'teamA', 0, 3, 2, 1500, 0], ['10006', '30002', 'HostB', 'pid_b', 'teamB', 0, 3, 1, 1400, 0]],
    },
  },
  // —— KO 死亡模式（仅首页小窗流 HomeStream 消费，主直播间暂未接线）——
  {
    id: 'kv-dying_escape_info', group: 'KO死亡模式', key: 'dying_escape_info', label: 'KO配置 (dying_escape_info)',
    template: { pk_id: 'pk_20260716_01', start_time: 1752600000000, end_time: 1752600300000, rule: [{ start: 1752600000000, end: 1752600060000, ttl: 30, danger_limit: 20, higher_double: 2, higher_triple: 3, lower_double: 2, lower_triple: 3 }] },
  },
  {
    id: 'kv-dying_escape_progress', group: 'KO死亡模式', key: 'dying_escape_progress', label: '进入危险 (dying_escape_progress)',
    template: { id: 1, pk_id: 'pk_20260716_01', lid: '30001', danger: true, outer_time: 1752600100000, occur_time: 1752600070000, deadline: 1752600130000 },
  },
  {
    id: 'kv-ko_fixed_danger', group: 'KO死亡模式', key: 'ko_fixed_danger', label: '触发固定毒圈 (ko_fixed_danger)',
    template: { pk_id: 'pk_20260716_01', percentage: 30 },
  },
  // —— 榜单/礼物 ——
  {
    id: 'kv-gift_top3_new', group: '榜单/礼物', key: 'gift_top3_new', label: '直播榜三 (gift_top3_new)',
    template: { gift_top3: [{ uid: '10001', profile_image_url: '', reward_coin: 500, audienceType: 0, user_decorator: { skin_id: 12 } }] },
  },
  // —— 投票/心愿 ——
  {
    id: 'kv-live_vote', group: '投票/心愿', key: 'live_vote', label: '直播投票 (live_vote)',
    template: { vote_id: 1001, content: 'Which song next?', duration: 60000, expire_at: 1752600060000, remain_time: 60000, state: 0 },
  },
  {
    id: 'kv-live_wish', group: '投票/心愿', key: 'live_wish', label: '心愿单 (live_wish)',
    template: { info: { wish_id: 'wish_1', status: 1, state: 0, end_time: 1752600600000, wish_info: [{ gift_id: 888, gift_count: 3, gift_total: 10 }], rank_info: [{ uid: '10001', icon_url: '' }] } },
  },
  {
    id: 'kv-live_star_wish', group: '投票/心愿', key: 'live_star_wish', label: '星愿 (live_star_wish)',
    template: { activity_list: [{ activity_id: 'sw_1', state: 0, activity_end_time: 1752600600000, star_wish_info: [{ gift_id: 888, gift_count: 3, gift_total: 10 }] }] },
  },
  // —— 红包/活动 ——
  {
    id: 'kv-live_lucky_box', group: '红包/活动', key: 'live_lucky_box', label: '直播间红包 (live_lucky_box)',
    template: { current_time: 1752600000000, box_list: [{ box_id: 'box_20260716', type: 1, start_time: 1752600000000, end_time: 1752600060000, duration_time: 1752600060000, img_url: '' }] },
  },
  {
    id: 'kv-live_activity_label', group: '红包/活动', key: 'live_activity_label', label: '活动道具入口 (live_activity_label)',
    template: { lid: '30001', sender_uid: '10001', key: 'live_activity_label', activities: [{ activity_id: 'a1', start_time: 1752600000000, end_time: 1752600600000, icon_small: '', callback_url: '', image_type: 0, count: 0, type: 1 }] },
  },
  // —— 评论区/置顶 ——
  {
    id: 'kv-live_tip_text', group: '评论区/置顶', key: 'live_tip_text', label: '评论区提示(多条) (live_tip_text)',
    template: { items: [{ en_msg: 'Welcome to the room', ar_msg: '', icon: '', type: 0 }, { en_msg: 'Be kind to each other', ar_msg: '', icon: '', type: 0 }] },
  },
  {
    id: 'kv-live_pin_message', group: '评论区/置顶', key: 'live_pin_message', label: '置顶评论 (live_pin_message)',
    template: { lid: '30001', pin_uid: 20001, pin_start_time: 1752600000000, pin_end_time: -1, msg_id: 'msg_1', msg_content: 'Follow for more!', user_info: { uid: '20001', nickname: 'Host', avatar: '', mask_man_skin_id: '' } },
  },
  {
    id: 'kv-add_block_key_word', group: '评论区/置顶', key: 'add_block_key_word', label: '添加屏蔽词 (add_block_key_word)',
    template: { en: 'Blocked keyword', ar: 'كلمة محظورة' },
  },
  // —— 赛事/广告 ——
  {
    id: 'kv-live_relate_match', group: '赛事/广告', key: 'live_relate_match', label: '赛事数量更新 (live_relate_match)',
    template: { version: 1, count: 2 },
  },
  {
    id: 'kv-ad_match_live_info', group: '赛事/广告', key: 'ad_match_live_info', label: '赛事状态 (ad_match_live_info)',
    template: { lid: '30001', scene: 1, maxTime: 3, match_exist: true, params: '{"lid":"30001","match_id":"m1","match_state":2}' },
  },
  {
    id: 'kv-ad_config_info_v2', group: '赛事/广告', key: 'ad_config_info_v2', label: '广告模式配置 (ad_config_info_v2)',
    template: { lid: 30001, scene: 1, maxTime: 3, params: '{"campaign":"c1","version":1,"status":1,"placements":[{"placement":"live_message","delivery_modes":[1,2],"interval_min":2},{"placement":"live_stream","delivery_modes":[1],"interval_min":null}]}' },
  },
];

// 分组辅助：把模板数组按 group 归并，供 <optgroup> 渲染
export function groupTemplates(list) {
  const map = new Map();
  for (const t of list) {
    if (!map.has(t.group)) map.set(t.group, []);
    map.get(t.group).push(t);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

/**
 * 依据 IM 模板 + 编辑器中的 JSON 文本，构建融云发送用的 { messageType, content }
 * @throws JSON 解析错误
 */
export function buildIMContent(tmpl, jsonText) {
  const parsed = JSON.parse(jsonText);
  if (tmpl.wrapAsLiveCustom) {
    // Live:Custom：content = { content: "<内层JSON字符串>", extra: "" }
    return { messageType: tmpl.objectName, content: { content: JSON.stringify(parsed), extra: '' } };
  }
  // 字段平铺型（弹幕/宝箱）
  return { messageType: tmpl.objectName, content: parsed };
}

/**
 * 依据 KV 模板 + 编辑器 JSON 文本，构建 KV value 字符串
 * @throws JSON 解析错误
 */
export function buildKVValue(tmpl, jsonText) {
  const parsed = JSON.parse(jsonText);
  // 纯数字/字符串型 value 直接转字符串，其余 JSON.stringify
  if (tmpl.rawValue) return String(parsed);
  return JSON.stringify(parsed);
}
