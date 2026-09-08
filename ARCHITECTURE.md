# rc-im-simulator 架构分析

> 更新时间：2026-08-06

## 一、项目定位

融云（RongCloud）IM 消息模拟器——一个面向直播业务测试的 Web 工具，用于连接融云私有化环境、加入聊天室，并模拟下发两类通道的数据：

- **IM 消息**：普通消息（文本/图片/自定义）与直播自定义消息（`Live:Custom` 等）
- **聊天室 KV 属性**：`setChatRoomEntry` / `forceSetChatRoomEntry`

同时实时展示下发结果日志，支持过滤、搜索、导出。

## 二、技术栈

| 层面 | 选型 |
|---|---|
| 构建 | Vite 8 + @vitejs/plugin-react，oxlint 做 lint |
| UI | React 19（函数组件 + Hooks），CSS Modules，自定义 CSS 变量主题（暗/亮双主题） |
| 状态 | React Context + `useReducer`（无 Redux 等外部状态库） |
| IM SDK | `@rongcloud/imlib-next` 5.42（函数式 API）+ `@rongcloud/engine` |
| 持久化 | localStorage（主题、房间 ID 输入历史） |

## 三、分层结构

```
┌─────────────────────────────────────────────────────┐
│ App.jsx  三栏工作流布局（① 连接&房间 ② 消息编辑 ③ 下发日志）│
├──────────────┬──────────────────┬───────────────────┤
│ ConfigPanel  │ MessageSender    │ LogPanel          │  组件层
│ RoomPanel    │  └ JsonEditor    │                   │
├──────────────┴──────────────────┴───────────────────┤
│ store/imStore.jsx   Context + Reducer（全局单一状态树）│  状态层
├─────────────────────────────────────────────────────┤
│ utils/rcClient.js       SDK 封装（防腐层 + Mock 降级） │  服务层
│ utils/messageTemplates  基础消息类型定义（表单驱动）    │  数据层
│ utils/liveTemplates     直播 IM/KV 模板库（30+ 模板）  │
├─────────────────────────────────────────────────────┤
│ @rongcloud/imlib-next（真实 SDK）｜ mockSDK（同签名）   │  SDK 层
└─────────────────────────────────────────────────────┘
```

## 四、各模块职责

### 4.1 状态层 `src/store/imStore.jsx`（72 行）

单一 reducer 管理：

- 连接配置（appKey / token / navServer / fileServer）与连接状态
- 房间列表 `rooms` 与当前选中房间 `activeRoom`
- 日志 `logs`（上限 500 条，新日志前插）与成功/失败统计 `stats`

组件通过 `useIM()` 读写，是三栏之间唯一的通信桥梁——组件间零直接耦合。

### 4.2 服务层 `src/utils/rcClient.js`（393 行）

项目的核心防腐层，把 SDK 的易错点全部收敛在这里：

- **Mock 降级**：SDK 动态 `import()` 失败时自动切换到同签名的 mockSDK，UI 层无感知，无凭据也能演示完整流程。
- **生命周期治理**：重连前必须 `destroy → init → connect`，并清空自定义消息类缓存（SDK destroy 后内部消息注册表会被清空）。
- **私有化 token 处理**：完整 token（含 `@rongnav;rongcfg` 后缀）直接交给 SDK 解析；若剥离后缀改用手动 navigators 会导致 connect 31004（"original decode failure"）。
- **参数纠偏**（历史 bug 的修复以注释形式沉淀在代码里）：
  - `joinChatRoom(roomId, {count})`——第二参数必须是对象，直接传数字报 34232；
  - 自定义消息必须先 `registerMessageType` 再发送，否则报 34021 MESSAGE_NOT_REGISTERED；
  - 聊天室会话类型是 4（CHATROOM），误用 10（ULTRA_GROUP）会报 24401。

### 4.3 数据层：双模板库

- `src/utils/messageTemplates.js`：基础消息（文本/图片/自定义）定义。每种类型自带 `fields` 表单描述 + `buildContent` 构建函数，表单是**数据驱动渲染**的。
- `src/utils/liveTemplates.js`：直播业务模板库。
  - IM 模板按 `wrapAsLiveCustom` 决定是否自动包一层 `Live:Custom`（content 为内层 JSON 字符串）；
  - KV 模板覆盖计数/连麦/PK/榜单/投票/红包/评论区/赛事广告等 8 个分组，`rawValue` 标记纯数字/字符串型 value；
  - 提供 `buildIMContent` / `buildKVValue` 纯函数完成「编辑器 JSON 文本 → SDK 参数」的转换。

### 4.4 组件层

| 组件 | 职责 |
|---|---|
| `ConfigPanel` | 凭据表单、一键演示凭据验证、连接/断开管理 |
| `RoomPanel` | 多会话类型房间管理（仅聊天室类型真正调 `joinChatRoom`），房间 ID 输入历史（localStorage，最多 10 条） |
| `MessageSender` | IM/KV 双通道切换、模板选择灌入编辑器、单发/批量定时下发（Count × Interval） |
| `JsonEditor` | 带 JSON 语法高亮的编辑器（textarea + 实时高亮预览） |
| `LogPanel` | 日志过滤（ALL/OK/ERR/SYS）、搜索、展开详情、导出 JSON、智能置顶吸附（向下滚动时暂停自动置顶） |

## 五、关键数据流

### 5.1 连接流

```
ConfigPanel
  → initRCClientFull（仅暂存 appKey）
  → connectRC → initAndConnect
      destroy 旧实例 → init({appkey}) → connect(完整原始 token)
  → 成功后 dispatch(SET_CONNECTED) + 日志
```

### 5.2 发送流（以 KV 为例）

```
MessageSender 读取 activeRoom
  → buildKVValue(模板, 编辑器文本)          // JSON 解析 + stringify
  → setChatRoomKV()
  → SDK setChatRoomEntry / forceSetChatRoomEntry
  → 结果 dispatch(ADD_LOG)
  → LogPanel 响应式更新 + 统计累加
```

批量模式是简单的 `for + setTimeout` 串行循环。

## 六、架构优点

1. **防腐层扎实**——所有 SDK 版本差异、签名陷阱、生命周期坑都收敛在 `rcClient.js` 一个文件，组件层完全不接触 SDK 细节。
2. **Mock 与真实 SDK 同签名**，无凭据也能演示完整流程。
3. **模板即数据**——新增一种直播消息/KV 只需在模板数组加一项，UI 自动出现在下拉分组里，零组件改动。
4. **单向数据流清晰**，日志作为唯一的"结果通道"贯穿所有操作。

## 七、潜在改进点

1. **`addMessageListener` 已封装但没有调用方**——接收消息监听未在任何组件接线，收到的下行消息不会进日志，是当前最明显的断点。
2. **`imStore` 的 `imClientRef` 是死代码**——rcClient 用模块级单例管理状态，两套机制留了一套没用的。
3. **连接配置无持久化**——appKey/token 每次刷新要重填（房间历史反而有 localStorage），体验不一致。
4. **批量发送不可中断**——`for` 循环发起后没有取消机制，Count=100 时只能等它跑完。
5. **日志 id 用 `Date.now()+Math.random()`**——够用但批量高频时理论上可碰撞；导出仅包含内存中最新 500 条，建议在 UI 上标注。
6. **未使用的依赖可清理**——`axios`、`dayjs`、`playwright`、`ws` 出现在 package.json 但源码中未使用。

## 八、总结

这是一个结构清晰的小型工具型 SPA：**组件层薄、服务层厚、模板数据化**。最有价值的资产是 `rcClient.js` 里沉淀的融云私有化环境踩坑经验（token 导航解析、destroy/init 顺序、joinChatRoom 参数、消息注册时机等）。
