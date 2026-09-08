# RC IM Simulator · 融云 IM 消息模拟器

一个基于 **React + Vite** 的融云（RongCloud）IM 调试工具，用于向聊天室 / 私聊 / 群组下发 **IM 消息** 与 **聊天室 KV 属性**，并实时查看下发日志。内置对 **直播间业务消息（Live:Custom / 弹幕 / 宝箱）** 和 **直播间聊天室 KV** 的完整模板，选中类型即自动填充该消息的 JSON 数据结构，方便快速改数据、联调直播间业务。

> 无真实 AppKey 时自动降级为 **Mock 模式**，可离线体验完整交互与 UI。

---

## ✨ 功能特性

- **连接管理**：填写 AppKey / Token（支持私有化部署 token 内嵌导航地址 `token@navHost;cfgHost`）、可选自定义导航/文件服务器与环境，一键连接/断开。
- **会话目标管理**：加入/退出聊天室，维护多个目标（聊天室 / 私聊 / 群组 / 超级群），切换当前下发目标。
- **两种下发通道**：
  - **💬 IM 消息**：基础消息（文本/图片/通知/语音/文件/自定义）+ **直播间业务消息**（`Live:Custom` 的 notice/gift/connect/pk 等全部类型，及 `Live:BulletComment` 弹幕、`Level:LevelBoxComment` 宝箱）。
  - **🗝️ KV 消息**：直播间聊天室 40+ 个 KV 属性（计数、连麦、PK、榜单、投票心愿、红包活动、置顶评论、赛事广告等），走 `setChatRoomEntry` / `forceSetChatRoomEntry`。
- **模板自动填充**：选中任一消息/KV 类型，编辑器立即出现该类型的 **JSON 数据结构模板**（含示例值与 `sub_type` 取值提示），直接改数即可；「↺ 重置模板」可恢复默认。
- **批量下发**：可设置发送次数与间隔（`×N @ Nms`），压测/连发场景使用。
- **KV 下发选项**：强制设置（force）、发送通知（isSendNotification）、退出自动删除（isAutoDelete）。
- **实时日志**：下发结果（成功/失败、错误码、msgUid、内容）实时记录，可筛选、导出。

---

## 🧱 技术栈

| 分类 | 依赖 |
|---|---|
| 框架 | React 19 + Vite 8 |
| IM SDK | `@rongcloud/imlib-next` / `@rongcloud/engine` 5.42 |
| 其他 | axios、dayjs |
| 质量 | oxlint、Playwright（冒烟测试） |

---

## 📁 目录结构

```
src/
├── App.jsx                     # 布局：配置 / 房间 / 发送 / 日志
├── store/imStore.jsx           # 全局状态（useReducer + Context）
├── utils/
│   ├── rcClient.js             # 融云 SDK 封装（含 Mock 降级、KV 下发）
│   ├── messageTemplates.js     # 基础消息类型 & 快捷模板 & 会话类型
│   └── liveTemplates.js        # 直播间 IM 消息 & KV 模板目录 + 构建工具
└── components/
    ├── ConfigPanel.jsx         # 连接配置
    ├── RoomPanel.jsx           # 会话目标（加入/退出聊天室）
    ├── MessageSender.jsx       # IM/KV 下发主面板
    ├── JsonEditor.jsx          # 轻量 JSON 编辑器
    └── LogPanel.jsx            # 下发日志
```

---

## 🚀 快速开始

```bash
npm install
npm run dev        # 本地开发（默认 http://localhost:5173）
npm run build      # 生产构建
npm run preview    # 预览构建产物
npm run lint       # oxlint
```

---

## 📖 使用流程

1. **连接**：在「配置」面板填入 AppKey 与 Token（私有化部署直接粘贴含 `@nav` 后缀的完整 token），点击连接。未配置真实 AppKey 时进入 Mock 模式。
2. **选目标**：在「房间」面板输入 room-id / user-id / group-id，选择会话类型并加入；点击列表项切换当前下发目标。
3. **下发消息**：
   - 选 **💬 IM 消息**：下拉选类型 → 编辑器出现模板 → 改数据 → `SEND`。
     - 直播间自定义消息发送时会自动包一层 `Live:Custom`（content 为内层 JSON 字符串）；弹幕/宝箱字段平铺下发。
   - 选 **🗝️ KV 消息**：下拉选 KV → 编辑器出现 value 结构 → 改数据 → 勾选下发选项 → `SET KV`。
4. **看日志**：在「日志」面板查看结果、错误码与下发内容，可筛选/导出。

---

## 🗂️ 直播间消息 / KV 模板来源

`src/utils/liveTemplates.js` 中的模板与字段依据 live-iOS 项目的梳理文档
`memory/live_room_im_message_types_fields.md` 生成，覆盖：

- **IM 消息**：`LiveMessageType` 全部大类（notice / platform / like / gift / connect / other / authority / challenge / block / luckybox / notification / mask / pk_props / live_tip_text / activity / cross_custom_pk_rule / broadcast）+ 弹幕 + 等级宝箱。
- **KV 消息**：`LiveChatRoomKVKey` 全部键，value 结构含嵌套子模型示例。

如需新增/调整模板，编辑 `LIVE_IM_TEMPLATES` / `LIVE_KV_TEMPLATES` 即可，字段与含义可对照上述文档。

---

## ⚠️ SDK 使用注意（封装中已处理）

- **会话类型枚举**：`PRIVATE=1, GROUP=3, CHATROOM=4, ULTRA_GROUP=10`。聊天室是 **4**，误用 10 会以超级群下发导致 `24401`。
- **重连需先 destroy**：重新 `init` 前必须 `destroy`，否则第二次 init 不生效。
- **完整 token 连接**：私有化部署要传含 `@nav` 后缀的完整 token，SDK 自行解析导航地址；剥离后手动指定易导致 `31004`。
- **加入聊天室签名**：`joinChatRoom(roomId, { count })`，`count ∈ [-1, 50]`；传数字会报 `34232`。
- **发送签名**：`sendMessage(conversation, message, options)`，`message` 必须是 `BaseMessage` 子类实例。
- **KV value 限制**：value 为字符串，最大 4096 字符；key 支持字母/数字/`+ = - _`，最大 128 字符。

---

## 🧪 Mock 模式

未检测到可用真实 SDK / AppKey 时，`rcClient.js` 自动切换到 Mock 实现：`connect` / `sendMessage` / `joinChatRoom` / `setChatRoomEntry` 等均返回 `code: 0` 的模拟结果，便于离线开发 UI 与联调交互逻辑。
