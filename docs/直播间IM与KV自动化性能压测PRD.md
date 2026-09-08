# 直播间 IM 与 KV 自动化性能压测产品需求文档

rc im simulator 与 live iOS 自动化测试整合方案

| 字段 | 内容 |
| --- | --- |
| 文档版本 | V1.0 |
| 文档日期 | 2026 年 9 月 7 日 |
| 适用范围 | iOS 真实设备直播间性能自动化测试 |
| 发送平台 | /Users/zhangjiang/Documents/Github/rc-im-simulator |
| 移动端工程 | /Users/zhangjiang/Documents/newLive/live-iOS |
| 主要读者 | 客户端研发 测试开发 IM 平台研发 性能负责人 |
| 状态 | 需求评审稿 |


---

# 文档说明

本文定义一个可由自动化框架直接调用的直播间性能压测能力。自动化脚本负责等待被测 App 进入直播间、取得测试上下文、启动独立消息发送账号、执行十分钟 IM 与 KV 场景、同步采集设备性能和客户端队列指标，并生成一份可以用于回归判定的统一报告。

核心决策是将现有网页模拟器的消息模板与融云封装抽成无界面的场景运行器。网页继续用于人工调试，自动化测试通过 CLI 或 HTTP API 调用同一套下发核心。移动端测试包增加受控的测试桥和低开销性能探针，在真实接收与渲染链路上记录消息数量、排队和播放数据。

## 目录

1. 背景与现状
2. 目标与范围
3. 总体方案
4. 端到端执行流程
5. 自动化脚本需求
6. 消息和 KV 场景设计
7. 指标口径与数据关联
8. rc im simulator 改造需求
9. live iOS 改造需求
10. 自动化框架对接需求
11. 结果判定与报告
12. 安全 稳定性与风险
13. 实施计划与验收

# 一 背景与现状

直播间核心交互同时消费公屏消息、飘屏弹幕、进场通知、普通礼物、全屏礼物、AR 礼物和聊天室 KV。消息到达后还会经过反序列化、业务分类、缓存排队、主线程刷新、图片或动画资源加载等阶段。单纯统计发送成功或设备平均 CPU，无法识别消息是否真正到达、是否被客户端丢弃、队列是否持续增长以及动画是否在压测结束后仍未播放完。

## 一 当前发送平台能力

`rc-im-simulator` 是 React 与 Vite 工程。当前包含 34 个直播 IM 模板和 40 个聊天室 KV 模板，底层已经封装融云连接、聊天室加入、IM 发送以及 KV 设置。主要入口为：

- `src/utils/rcClient.js`：连接、加入聊天室、发送 IM、设置 KV。
- `src/utils/liveTemplates.js`：直播 IM 与 KV 模板及内容构建。
- `src/components/MessageSender.jsx`：页面中的单发和串行批量发送。

当前批量功能最多 100 次，并采用“等待本次发送完成后再等待固定间隔”的串行方式。网络 ACK 时间会叠加到发送间隔，无法保证目标频率，也没有运行 ID、停止能力、状态查询和机器可读报告。SDK 加载失败时会降级到 Mock，此行为在自动化环境可能产生零真实负载但用例仍继续的问题。

## 二 当前 iOS 消费链路

`live-iOS` 已完成融云与自研 IM 双通道 Hub 改造。直播间通过 `JacoLiveMessageViewModel` 加入房间，在 `chatRoomDidReceive` 接收消息，再转换为融云消息对象并交给 `LiveMessageManager` 分类。当前重要的消费特征如下。

| 链路 | 当前实现 | 对压测的影响 |
| --- | --- | --- |
| 公屏消息 | `LiveMessageManager.chatCache` 缓存，每 3 秒消费一次，根据积压量单次取 3 至 75 条 | 必须统计缓存深度、等待时长、批量渲染耗时和超过 150 条显示上限后的裁剪 |
| 通知区 | 礼物、关注、升级、点赞、进场等独立队列共享每秒一个展示机会，并按优先级消费；超过 10 秒的部分通知会被过滤 | 必须记录各类型入队、出队、过期丢弃和优先级饥饿 |
| 飘屏弹幕 | `LiveBulletCommentView` 最大缓存 100 条，每 0.5 秒尝试调度一条 | 持续高于约 2 条每秒会产生预期积压；达到 100 后新增消息可能不入队 |
| 全屏礼物 | `LiveRoomEffectGiftView` 有我的礼物、他人礼物和道具三个队列，按优先级串行播放；相同发送人和礼物可能聚合 | 必须分别统计排队、合并、资源下载、开始播放、播放结束和被清理 |
| KV | 融云或自研通道经 Hub 下发，多个业务模块消费；同 key 更新属于状态覆盖 | 必须用递增版本识别覆盖和乱序，不应把 KV 当普通事件流统计 |

## 三 当前性能采集能力

iOS 工程已有 APM 插件框架。CPU 插件能够汇总当前进程线程 CPU，内存插件能够取得 App memory footprint，卡顿插件通过主线程 RunLoop 超时检测。现有 FPS 插件虽然使用 `CADisplayLink` 计算帧率，但未启动采集，也未在 `getPluginInfo` 中写入 `JacoAPMDeviceInfo`。线程插件为空实现，MetricKit 仅为被动回调，不能承担单次十分钟测试的实时结果输出。自动化测试需要新增独立的会话型探针，不直接依赖线上 APM 上传节奏。

# 二 目标与范围

## 一 产品目标

1. 自动化用例在被测 App 进入指定直播间后，能够取得环境、AppKey、房间 ID、当前 IM 通道和就绪状态。
2. 压测端使用独立发送账号 Token 连接融云并加入同一聊天室，按场景配置同步发送多类 IM 与 KV。
3. 一次测试默认运行 600 秒，支持预热、稳定负载、峰值突发和恢复观察阶段。
4. 在真实设备上每秒采集 CPU、内存、FPS、卡顿、热状态和前后台状态。
5. 统计目标数、计划触发数、实际尝试数、发送成功数、发送失败数、App 接收数、解析数、入队数、开始展示数、完成展示数和丢弃数。
6. 输出公屏、通知、弹幕和礼物的排队时长、播放时长、队列峰值及恢复时间。
7. 结果能够由 CI 读取并产生 PASS、FAIL 或 INVALID。

## 二 非目标

- V1 不替代融云服务端容量测试。本方案主要测量单台被测设备收到高频消息后的 App 性能。
- V1 不通过真实扣费接口送礼。礼物使用符合客户端协议的测试消息驱动展示链路。
- V1 不修改生产包行为。测试桥、明细日志和高频采样仅在 `PERF_TEST` 或受控 Debug 构建中启用。
- V1 不用被测用户账号作为发送账号，避免同账号连接互踢和自发消息过滤影响统计。
- V1 以融云聊天室为主。若房间只启用自研 Jaco IM 通道，必须在开始前判定为不支持，或由后续版本补充 Jaco Agent 发送适配器。

## 三 成功标准

| 类别 | 成功标准 |
| --- | --- |
| 可调用 | 一条 CLI 命令或一个 HTTP 请求可以启动、查询和停止完整场景 |
| 可关联 | 发送端与 App 端均携带同一 `run_id`，每条测试消息可按 `sequence` 对账 |
| 可诊断 | 报告能够区分发送不足、传输丢失、解析丢弃、客户端积压和渲染性能下降 |
| 可重复 | 相同设备、构建和网络条件下重复测试使用同一场景配置并保存环境快照 |
| 可门禁 | CI 能从 JUnit 与 JSON 摘要读取 PASS、FAIL、INVALID 及具体失败原因 |

# 三 总体方案

## 一 系统组成

```text
自动化测试框架
    │
    ├── 控制 iOS 真实设备进入直播间
    ├── 从测试桥读取 room context 和 room ready
    ├── 启动移动端性能采集会话
    └── 调用 Live Performance Orchestrator
              │
              ├── Token Provider 获取独立发送账号凭证
              ├── Scenario Runner 生成时间表和消息载荷
              ├── Rong Worker Pool 发送 IM 与 KV
              └── Run Registry 保存状态和发送报告
                         │
                    融云聊天室
                         │
                    live iOS 被测 App
                         │
              接收 解析 入队 渲染 播放 性能采样
                         │
                   Device Result Exporter
                         │
              Report Merger 统一对账和生成门禁结果
```

## 二 职责边界

| 组件 | 主要职责 | 明确不承担 |
| --- | --- | --- |
| rc im simulator | 凭证接入、真实连接、模板构建、频率调度、IM/KV 下发、发送侧统计 | 不判断 App 是否真正渲染 |
| live iOS | 上报测试上下文、记录接收与业务阶段、采集设备与队列指标、导出结果 | 不控制外部发送频率，不保存发送账号 Secret |
| 自动化框架 | 设备控制、进入直播间、同步开始与停止、失败清理、产物归档、CI 门禁 | 不复制 IM 协议模板 |
| Token Provider | 根据环境和发送账号生成短期 Token | 不向日志或报告输出原始 Token |

## 三 凭证设计决策

AppKey 不是 Secret，可以由测试桥返回。Token 是用户凭证。被测 App 当前融云 Token 保存在 UserDefaults，直接导出并用于外部连接可能造成同账号会话互踢、消息被当作自己发送而被过滤，也会扩大泄露风险。因此 V1 采用以下规则。

1. iOS 测试桥返回 `environment`、`rong_app_key`、`room_id`、`im_vendors`、`receiver_uid` 和就绪状态。
2. 编排脚本根据环境和预配置的 `sender_user_ids` 向 Token Provider 请求独立、短期发送 Token。
3. 若现阶段无法提供 Token Provider，可以在 Debug 包通过受保护的本机通道读取 Token，但发送账号仍必须与被测账号不同。
4. Token 仅保存在进程内存，不进入命令行参数、普通日志、JSON 报告和 CI Artifact。

# 四 端到端执行流程

## 步骤零 测试前置检查

自动化框架在进入直播间之前完成设备和环境检查。任何必要条件不满足时，测试直接标记 INVALID。

- 确认物理设备在线、已解锁、电量和充电状态符合实验规范。
- 记录设备型号、系统版本、屏幕最高刷新率、App 版本、Git commit、构建类型和网络类型。
- 确认 App 为带 `PERF_TEST` 能力的测试构建。
- 确认压测服务健康、模板版本一致、系统时间偏差在允许范围内。
- 确认测试房间存在且当前通道包含 Rong。Jaco only 房间在 V1 标记不支持。
- 清理上次测试的本地结果、残留运行和测试 KV。

## 步骤一 App 进入直播间并获取上下文

1. 自动化框架启动 App，完成登录，并导航到目标直播间。
2. `JacoLiveMessageViewModel` 发起 Hub 连接和聊天室加入。
3. 所有要求的 IM vendor 加入成功、首屏 KV 同步完成、前景视图已注册消息监听后，测试桥将状态更新为 `room_ready`。
4. 自动化脚本调用 `GET /perf/context` 或读取等价本机文件，取得房间上下文。
5. 脚本校验 UI 所在房间、Hub 当前房间和返回的 `room_id` 完全一致。

测试上下文返回示例：

```json
{
  "schema_version": 1,
  "receiver_uid": "1300000139",
  "room_id": "30001",
  "environment": "test",
  "rong_app_key": "***",
  "im_vendors": ["rong"],
  "room_state": "ready",
  "kv_first_sync_completed": true,
  "app_build": "6.12.0-abcdef",
  "device_time_ms": 1788748800000
}
```

## 步骤二 获取发送凭证并加入聊天室

1. 编排脚本根据 `environment` 和发送账号池向 Token Provider 请求 Token。
2. 场景运行器以 `allowMock=false` 初始化融云客户端。SDK 加载失败或连接失败立即停止测试。
3. 运行器校验连接返回用户 ID 与请求的发送账号一致。
4. 每个发送 worker 加入 `room_id`，等待成功 ACK。
5. 发送一条带 `run_id` 的探针消息，等待 iOS 测试桥报告已接收。探针超时则停止测试。

## 步骤三 启动性能会话

1. 自动化框架调用 iOS 测试桥 `POST /perf/sessions`，传入 `run_id`、场景 ID 和采样周期。
2. iOS 侧清零消息计数器和队列峰值，启动 CPU、内存、FPS、卡顿、热状态采集。
3. 记录 60 秒无负载基线。基线期间播放器保持正常播放，不能停视频以制造不真实的空闲状态。
4. 移动端返回 `metrics_ready` 后，编排脚本才允许场景进入负载阶段。

## 步骤四 执行十分钟场景

| 阶段 | 时长 | 负载 | 目的 |
| --- | --- | --- | --- |
| 基线 | 60 秒 | 0 | 记录同一直播间无测试消息时的 CPU 内存 FPS |
| 预热 | 60 秒 | 目标频率 25% | 建立连接、加载图片和常用资源，观察初始波动 |
| 稳定负载 | 360 秒 | 目标频率 100% | 统计主要性能结果和内存趋势 |
| 峰值突发 | 60 秒 | 目标频率 200% 或场景指定突发值 | 观察队列上限、丢弃策略和恢复能力 |
| 恢复 | 60 秒 | 0 | 观察积压排空、内存回落和 FPS 恢复 |

如果业务要求“满负载运行十分钟”，基线、预热与恢复应作为额外时间，稳定负载阶段单独设置为 600 秒。

## 步骤五 停止并收集结果

1. 运行器停止生成新消息，保留已发请求的 ACK 收集。
2. 等待可配置的排空时间。普通场景默认 20 秒，全屏礼物场景默认 60 秒。
3. iOS 测试桥停止性能会话并落盘 `device_metrics.jsonl`、`message_events.jsonl` 和 `device_summary.json`。
4. 运行器输出 `sender_events.jsonl` 和 `sender_summary.json`。
5. 报告合并器按 `run_id` 与 `sequence` 对账，生成最终报告。
6. 自动化框架退出直播间、清除测试 KV、断开 worker 并归档产物。

# 五 自动化脚本需求

## 一 命令行入口

```text
npm run perf:live -- \
  --device-udid 00008140-XXXXXXXX \
  --scenario scenarios/live/mixed-peak.json \
  --room-source app \
  --duration 600 \
  --output artifacts/run-20260907-001
```

命令行不得传入原始 Token。凭证通过 CI Secret、受限环境变量或 Token Provider 注入。

## 二 脚本状态机

| 状态 | 进入条件 | 超时或失败处理 |
| --- | --- | --- |
| PRECHECK | 命令启动 | 环境不满足时 INVALID |
| WAITING_ROOM | App 导航到直播间 | 房间未 ready 时保存截图和日志后 INVALID |
| CONNECTING_SENDERS | 获得房间上下文 | 任何必需 worker 连接或加入失败时 INVALID |
| PROBING | 发送者全部入房 | 探针未被 App 收到时 INVALID |
| BASELINE | 移动端采集 ready | App 退后台或热状态异常时 INVALID |
| RUNNING | 基线完成 | 可配置 fail fast 或记录后继续 |
| DRAINING | 停止产生消息 | 排空超时记录为积压未恢复 |
| COLLECTING | 移动端停止采集 | 缺少必需产物时 INVALID |
| COMPLETED | 报告合并完成 | 输出 PASS FAIL 或 INVALID |

## 三 场景运行器调度要求

- 使用单调时钟，计划发送时间为 `phaseStart + sequence / rate`。
- 发送 ACK 不应阻塞后续计划任务。运行器使用有界并发队列，并单独记录 ACK 延迟。
- 每个 stream 独立限速，混合场景不得使用一个串行循环轮流发送所有类型。
- 支持固定频率、固定间隔、短时 burst 和加权随机四种调度方式。
- 队列达到上限时不静默丢弃。记录 `scheduler_rejected` 并按配置停止或降速。
- 支持 `AbortController` 和幂等停止。收到系统信号、设备断连或 App 退后台时必须停止新发送。
- 高频场景可配置多个独立 sender Token。单 worker 吞吐不足时扩展 worker 数，不能通过无限增大本地并发掩盖服务端限流。

## 四 HTTP 控制接口

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/api/v1/health` | 检查 SDK、模板和 Token Provider 状态 |
| GET | `/api/v1/templates` | 返回可用模板 ID、协议版本和内容摘要 |
| POST | `/api/v1/runs` | 创建并异步启动运行 |
| GET | `/api/v1/runs/{runId}` | 查询阶段、进度、实际 RPS 和错误 |
| DELETE | `/api/v1/runs/{runId}` | 幂等停止运行并进入结果收集 |
| GET | `/api/v1/runs/{runId}/report` | 获取发送侧汇总和产物路径 |

## 五 创建运行请求

```json
{
  "run_id": "run_20260907_001",
  "room_id": "30001",
  "environment": "test",
  "duration_sec": 600,
  "sender_pool": { "size": 3, "account_group": "live_perf_sender" },
  "phases": [
    { "name": "baseline", "duration_sec": 60, "multiplier": 0 },
    { "name": "warmup", "duration_sec": 60, "multiplier": 0.25 },
    { "name": "steady", "duration_sec": 360, "multiplier": 1 },
    { "name": "burst", "duration_sec": 60, "multiplier": 2 },
    { "name": "recovery", "duration_sec": 60, "multiplier": 0 }
  ],
  "streams": [
    { "id": "comment", "template_id": "basic:RC:TxtMsg", "rate_per_sec": 8 },
    { "id": "bullet", "template_id": "im-bullet", "rate_per_sec": 3 },
    { "id": "join", "template_id": "im-notice-join", "rate_per_sec": 2 },
    { "id": "gift", "template_id": "im-gift-normal", "rate_per_sec": 2 },
    { "id": "big_gift", "template_id": "im-gift-fullscreen", "interval_sec": 10 },
    { "id": "counter", "template_id": "kv-live_play_counters", "rate_per_sec": 1,
      "options": { "force": true, "is_send_notification": true } }
  ]
}
```

# 六 消息和 KV 场景设计

所有默认频率均为自动化接入初值，不代表融云或线上业务正式容量。首轮落地后应使用生产峰值 P95 和聊天室服务限流配置校准。每个单场景先独立运行，再执行混合场景，避免不同队列互相影响后无法归因。

## 一 负载等级

| 等级 | 定义 | 用途 |
| --- | --- | --- |
| L0 | 无测试消息 | 建立同房间基线 |
| L1 | 日常高位流量 | 持续稳定性与常规回归 |
| L2 | 业务峰值 | 版本发布前主门禁 |
| L3 | 超过消费能力的短时突发 | 验证丢弃、限流、积压和恢复策略 |

## 二 场景矩阵

| 场景 | 模板 | L1 | L2 | L3 | 核心观察 |
| --- | --- | --- | --- | --- | --- |
| 无消息基线 | 无 | 0 | 视频正常播放时 CPU 内存 FPS 和热状态 |  |  |
| 公屏文本 | `basic:RC:TxtMsg` | 5 条每秒 | 10 条每秒 | 20 条每秒 60 秒 | chatCache 深度、3 秒批量出队、列表刷新耗时、150 条裁剪 |
| 飘屏弹幕 | `im-bullet` | 1 条每秒 | 2 条每秒 | 5 条每秒 60 秒 | 100 条上限、拒绝数、头像加载、轨道不足、等待时长 |
| 进场通知 | `im-notice-join` | 0.5 条每秒 | 1 条每秒 | 3 条每秒 60 秒 | 通知队列优先级、10 秒过期丢弃、装扮布局成本 |
| 普通礼物 | `im-gift-normal` | 1 条每秒 | 3 条每秒 | 5 条每秒 | 礼物轨道刷新、合并策略、图片资源和音效 |
| 全屏礼物热缓存 | `im-gift-fullscreen` | 每 20 秒 1 条 | 每 5 秒 1 条 | 每秒 1 条 30 秒 | operation 队列、开始和结束、播放积压、恢复时间 |
| 全屏礼物冷缓存 | `im-gift-fullscreen` | 每 30 秒 1 个不同 giftId | 每 10 秒 1 个 | 按资源清单突发 | 下载时间、下载失败、解压和首次播放峰值 |
| AR 礼物 | `im-gift-ar` | 每 30 秒 1 条 | 每 10 秒 1 条 | 每 3 秒 1 条 | AR 资源、渲染占用、与普通礼物并发 |
| KV 计数 | `kv-live_play_counters` | 0.2 次每秒 | 1 次每秒 | 3 次每秒 | 通知接收、版本连续性、覆盖、最终值一致性 |
| KV 多键混合 | 计数 榜单 状态等允许键 | 2 键轮询 | 5 键轮询 | 10 键短时 | 各业务观察者的主线程成本和乱序 |
| 综合峰值 | 文本 弹幕 进场 礼物 KV | 各 L1 叠加 | 各 L2 叠加 | 指定业务大促模型 | CPU P95、FPS P5、积压峰值和排空时间 |

## 三 测试数据生成规则

- 每条消息包含 `run_id`、`stream_id`、`sequence`、`scheduled_at_ms` 和 `sent_at_ms`。字段放在协议允许的业务 `extra` 中；严格模型不能接受未知字段时，由发送端保存 `messageUId` 映射。
- 用户 ID、昵称、头像 URL、等级和装扮按固定随机种子生成，保证同一场景可重放。
- 测试接收账号不得出现在 sender pool，避免客户端对“自己的消息”的特殊过滤。
- 普通礼物积压测试使用不同 uid 或 giftId，避免相同礼物被聚合；连击测试则固定 uid、giftId 和 toUid，验证合并路径。
- 冷缓存礼物必须先清理指定测试资源并使用真实可下载资源；资源不存在导致的不播放应单独计为数据准备失败。
- KV value 使用单调递增 `version`。同一 key 只由一个 worker 写入，除非场景明确验证并发覆盖。
- 图片和头像准备固定的本地 CDN 测试资源，分别覆盖命中缓存、首次下载和下载失败。

## 四 场景验收要点

### 公屏文本

验证目标是公屏缓存和列表渲染。在 `LiveMessageManager.handleTextMessage` 记录解析与入队，在 `onMessageCallHandler` 记录批量出队，在 `LiveMessageListViewModel.onMessagesReturn` 和列表更新完成点记录渲染。报告必须显示 chatCache 峰值、P95 排队时长、单次批量数量和列表裁剪数量。

### 飘屏弹幕

验证目标是弹幕排队和轨道调度。记录 `onReceiveBulletMessage` 接收与入队、超过 100 条未入队、`timerRun` 取出、没有可用轨道而重试、头像下载和 renderer receive。L3 应允许产生积压，但恢复阶段必须报告是否在目标时间内排空。

### 进场和通知

验证目标是通知优先级和过期策略。分别统计 noticeJoins、noticeGifts、noticeFollows 等队列，避免只看总队列掩盖低优先级进场消息饥饿。超过 10 秒被过滤的消息计为 `expired_drop`，不能计入已展示。

### 礼物

普通礼物和全屏礼物必须拆开。全屏礼物从 `onFullScreenGiftMessage` 开始，覆盖创建 operation、入队、资源准备、开始播放、播放结束、手动停止、合并和清理。播放时长取播放器回调，不用消息发送到动画结束的总时间代替。报告同时给出等待时长和实际播放时长。

### KV

每次设置成功仅代表服务端接受。App 侧必须在 Hub KV 回调处记录 key、version、接收时间和最终业务应用结果。中间版本因状态覆盖未展示时，报告标记为 superseded，不与 IM 丢失混为一类。测试结束后读取最终 KV，校验最终 version 和 value。

# 七 指标口径与数据关联

## 一 发送侧指标

| 指标 | 定义 |
| --- | --- |
| target_count | 按场景时长和目标频率计算的理论数量 |
| scheduled_count | 进入本地调度队列的数量 |
| attempted_count | 实际调用 SDK 的数量 |
| success_count | SDK 返回成功的数量 |
| failed_count | SDK 返回失败或抛错的数量，按错误码分类 |
| scheduler_rejected | 本地有界队列满而未调用 SDK 的数量 |
| effective_rps | 稳定阶段 attempted_count 除以有效时长 |
| schedule_lag_ms | 实际调用 SDK 时间减计划时间 |
| ack_latency_ms | SDK 调用开始到返回 ACK 的时间 |

## 二 App 消息指标

| 阶段事件 | 推荐埋点位置 | 说明 |
| --- | --- | --- |
| transport_received | `JacoLiveMessageViewModel.chatRoomDidReceive` | 进入直播业务前的真实接收数，包含 vendor 和 left |
| bridge_failed | `message.toRongMessage` 失败分支 | 双通道消息转换失败 |
| decoded | `LiveMessageManager.onMessageReceived` | 识别为文本、Live Custom 或弹幕 |
| classified | `handleLiveCustomMessage` | 成功解析 type 和 sub_type |
| queued | chatCache、notice、bullet、gift operation 入队点 | 记录队列名和入队后深度 |
| render_started | 列表刷新、弹幕 receive、礼物播放器 start | 表示业务开始呈现 |
| render_completed | 列表刷新完成、弹幕结束、礼物播放结束 | 没有明确回调的控件需补充轻量回调 |
| dropped | 过滤、上限、过期、后台、清屏等分支 | 必须记录原因 |

## 三 性能指标

| 指标 | 采样与汇总 | 注意事项 |
| --- | --- | --- |
| CPU | 每秒采样进程 CPU，输出 mean、P50、P95、max | 当前实现可能跨核心超过 100%，报告需保留原始口径 |
| 内存 | 每秒采样 memory footprint，输出 baseline、end、max、P95 和 MB 每分钟斜率 | 稳定阶段与恢复阶段分别计算 |
| FPS | CADisplayLink 每秒聚合，输出 mean、P5、min、低于阈值时间占比 | 按设备最大刷新率归一化，同时保存原始 FPS |
| 卡顿 | 统计主线程阻塞超过 50、100、250 和 1000 毫秒的次数与总时长 | 现有 666 毫秒连续三次的逻辑过于粗，需要测试会话专用探针 |
| 热状态 | 每秒记录 nominal、fair、serious、critical | serious 或 critical 是否 INVALID 由实验规范配置 |
| 前后台 | 记录状态变化 | 观众端进后台会主动过滤部分礼物和弹幕 |

## 四 时长指标

- 传输时长：`transport_received_at - sent_at`。
- 解析时长：`classified_at - transport_received_at`。
- 排队时长：`render_started_at - queued_at`。
- 播放时长：`render_completed_at - render_started_at`。
- 端到端时长：`render_completed_at - sent_at`。
- 恢复时长：停止产生消息到所有要求队列回到阈值以内的时间。

跨设备绝对时间只用于传输和端到端时长。测试前应比较主机与 App 的校准时间；偏差超过阈值时这些指标标记不可用。所有进程内部持续时间使用单调时钟，避免系统时间调整影响。

## 五 队列指标

| 队列 | 必须输出 |
| --- | --- |
| 公屏 chatCache | 当前深度、峰值、入队数、出队数、P95 等待、每批数量 |
| 通知各子队列 | 各类型深度、峰值、过期丢弃、优先级等待 |
| 弹幕队列 | 当前深度、峰值、达到 100 次数、未入队数、轨道重试数 |
| 礼物 operation | 我的、他人、道具队列深度，合并数，下载等待，播放等待，排空时间 |

# 八 rc im simulator 改造需求

## 一 代码结构

| 新增或调整模块 | 需求 |
| --- | --- |
| `src/core/rcClientFactory.js` | 将模块单例改为可实例化 client；支持多个 sender；自动化模式禁止 Mock |
| `src/core/messageDispatcher.js` | 把 `MessageSender.doSend` 从 React 抽出，统一处理 templateId、payload patch、IM/KV 参数和 trace 字段 |
| `src/core/scenarioRunner.js` | 解析 phases 与 streams，管理生命周期、停止、排空和状态 |
| `src/core/rateScheduler.js` | 单调时钟调度、有界并发、每 stream 限速、调度滞后统计 |
| `src/core/tokenProvider.js` | 从受控服务获取短期 Token，不记录原文 |
| `src/core/runReporter.js` | 输出 sender events、summary 和错误码聚合 |
| `server/apiServer.js` | 实现 runs、health、templates 接口及 run registry |
| `bin/live-perf.js` | 提供 CI CLI，协调移动端桥、runner 和报告合并 |
| `scenarios/live/*.json` | 保存版本化场景，包含 schema_version 和 template_version |

## 二 现有模块调整

- `src/utils/rcClient.js`：保留 SDK 防腐逻辑，但删除自动化路径的隐式 Mock；Token 日志只显示不可逆摘要。
- `src/utils/liveTemplates.js`：给模板补充 `schemaVersion`、`scenarioTags`、可变字段声明和 trace 注入策略。
- `src/components/MessageSender.jsx`：页面改为调用相同 `messageDispatcher` 或 `scenarioRunner`，避免人工与自动化协议分叉。
- `src/components/ConfigPanel.jsx`：移除代码内演示 Token。若需演示，由环境变量或本地未提交配置注入，并轮换已提交过的 Token。
- `package.json`：增加 `perf:server`、`perf:live`、`test:core` 和 `test:scenario`。

## 三 Runner 功能要求

1. 对模板 ID、频道、房间、频率、持续时间、KV key 和 value 长度进行启动前校验。
2. IM 发送保存 SDK 返回的 messageUId；KV 保存 key、sequence、value hash 和 ACK。
3. 生成的 unique_id、uid 和 sentAt 不得在批量消息中固定不变，除非场景明确要求聚合。
4. 连接断开时暂停新发送并尝试有界重连；重连期间的计划任务按策略丢弃或补发，必须在报告中说明。
5. 实现 worker 池，但每个聊天室 KV key 保持单 writer。
6. 运行过程中每秒发布 progress，包括目标 RPS、实际 RPS、在途请求、调度队列和错误率。
7. 进程异常退出时写入部分报告并将状态置为 ABORTED。

## 四 测试要求

- 模板构建单元测试覆盖 Live Custom 包装、弹幕平铺、KV rawValue 和非法 JSON。
- 使用 fake clock 验证各 phase 数量、频率、停止和恢复，不依赖真实等待十分钟。
- 使用 fake SDK 验证并发上限、ACK 超时、限流错误和断线重连。
- 提供真实测试聊天室的 smoke 测试，但默认不在普通单元测试中运行。

# 九 live iOS 改造需求

## 一 测试桥

新增 `LivePerformanceTestBridge`，只在 `PERF_TEST` 构建启用。推荐复用工程已有 GCDWebServer 依赖，在设备端启动只监听本机或通过端口转发访问的 HTTP 服务；如果现有自动化框架已有设备命令通道，也可以实现同等协议。

| 接口 | 作用 | 关键返回 |
| --- | --- | --- |
| `GET /perf/context` | 读取直播间测试上下文 | roomId、AppKey、vendors、receiver uid、ready 状态 |
| `POST /perf/sessions` | 启动采集会话 | session id、采样周期、开始时间 |
| `GET /perf/sessions/{id}` | 查询实时状态 | CPU、内存、FPS、队列深度、接收数 |
| `DELETE /perf/sessions/{id}` | 停止并落盘 | 摘要和产物路径 |
| `POST /perf/reset` | 清理计数和测试数据 | 清理结果 |

测试桥不得提供 appSecret，不得在正式包启动，不得绑定公网网卡。若临时提供 Token 读取，必须增加一次性会话密钥、日志脱敏和构建开关。

## 二 房间就绪信号

在 `JacoLiveMessageViewModel+Internal.joinChatRoom` 成功回调中，当前代码会设置 host client info、同步首屏 KV 并最终设置 `inImRoom`。测试桥需要组合以下条件后才返回 ready：

- 当前 roomId 非空并与 `LiveRoomDataManager.shared.roomInfo.roomId` 一致。
- 当前场景要求的 vendor 均已连接并加入聊天室。
- `isInImRoom` 为 true。
- 消息 manager 与列表、弹幕、礼物事件监听者已经注册。
- 有 Jaco 通道时首屏 KV 同步已经完成；Rong 单通道沿用其 join 后全量 KV 语义。
- App 位于前台且直播画面已经进入稳定播放状态。

## 三 会话型性能探针

新增 `LivePerformanceProbe`，对现有 CPU 和内存采集方法进行复用，但使用独立的会话生命周期和 JSONL 落盘，不等待线上 APM 上传。

- CPU：复用 `JacoAPMCPUPlugin.getCPUUsageForCurrentTask`。
- 内存：复用 `JacoAPMMemoryPlugin.getMemoryPluginInfo`。
- FPS：修复 `JacoAPMFPSPlugin`，开放 start、stop 和 snapshot，将结果写入 `JacoAPMFpsInfo`。
- 卡顿：新增面向测试的主线程 heartbeat，保留每次阻塞起止时间和分桶，不复用当前只在严重卡顿时触发上报的粗粒度结果。
- 环境：每秒记录 ProcessInfo thermalState、App active 状态、电量和网络类型。
- 采样：默认 1 秒，写文件放在后台串行队列，缓冲批量 flush，避免采集本身造成明显负载。

## 四 消息生命周期埋点

| 文件或模块 | 需要增加的事件 |
| --- | --- |
| `JacoLiveMessageViewModel+Message.swift` | transport_received、filter_rejected、bridge_failed，记录 vendor、objectName、messageUId、left |
| `LiveMessageManager.swift` | decoded、classified、chat 或 notice queued、expired_drop、batch_dequeued |
| `LiveMessageListViewModel.swift` | 列表接收、数据裁剪、刷新提交和刷新完成 |
| `LiveBulletCommentView.swift` | 弹幕入队、队列满丢弃、取出、无轨道重试、renderer 提交和结束 |
| `LiveRoomEffectGiftView.swift` | 礼物 operation 创建、合并、三个队列深度、取出、清理和暂停 |
| `LiveRoomEffectGiftOperation.swift` | 开始播放、播放结束、资源缺失、下载等待、手动停止和 combo 次数 |
| `JacoLiveMessageViewModel+KV.swift` | KV 收到、解析、业务应用、忽略或覆盖，记录 key 和 version |

## 五 队列快照接口

现有关键队列多为 private。测试构建需要通过内部协议返回只读快照，不能让测试代码直接修改队列。

```text
struct LivePerfQueueSnapshot: Codable {
  let timestampMs: Int64
  let chatCacheDepth: Int
  let noticeGiftDepth: Int
  let noticeJoinDepth: Int
  let bulletDepth: Int
  let effectGiftMyDepth: Int
  let effectGiftOtherDepth: Int
  let effectGiftInventoryDepth: Int
  let effectGiftPlaying: Bool
}
```

## 六 Trace 解析

增加 `LivePerfTraceExtractor`，从 RCTextMessage、Live Custom 和弹幕允许字段中读取 trace。业务模型严格时，通过 messageUId 与运行开始时下发到测试桥的映射对账。测试埋点必须在无法提取 trace 时继续统计业务总量，并单独增加 `unmatched_test_message`。

## 七 双通道要求

- 上下文必须返回当前 `im_vendors`，自动化不能假设所有房间都走 Rong。
- Rong 与 Jaco 双发时记录 message source 和 dual message ID，避免将去重后的业务消息误判为丢失。
- `jim_test_user` 等现有双通道字段保持业务语义，压测 trace 不得改变去重行为。
- V1 Runner 不支持 Jaco only 时，启动前明确返回 `UNSUPPORTED_VENDOR`，不能继续产生无效报告。

## 八 测试包控制参数

通过 launch arguments 或 launch environment 启用功能：

```text
-LivePerfTestEnabled YES
-LivePerfBridgePort 18181
-LivePerfSampleIntervalMs 1000
-LivePerfOutputDirectory <automation supplied path>
-LivePerfSessionSecret <ephemeral secret>
```

测试桥启动成功后在系统日志输出不含凭证的 ready 标识。正式构建编译时不包含接口实现或始终返回不可用。

# 十 自动化框架对接需求

## 一 必需能力

1. 指定设备启动、终止和重启 App。
2. 完成登录并进入可控直播间，识别直播画面稳定状态。
3. 通过端口转发或现有设备通道访问 iOS 测试桥。
4. 启动外部 Runner，并在用例取消时同步停止运行。
5. 获取 App 容器内 JSONL 和摘要文件。
6. 测试失败时保存截图、设备日志、App 日志和 sender 错误。
7. 将最终 JUnit 结果发布到 CI，并归档 JSON、CSV 和 HTML 报告。

## 二 自动化用例伪代码

```text
async function runLivePerformanceTest(config) {
  const runId = createRunId();
  await device.precheck(config.deviceUdid);
  await app.launch({ perfTest: true, runId });
  await app.login(config.receiverAccount);
  await app.enterLiveRoom(config.roomEntry);

  const context = await appBridge.waitForRoomReady({ timeoutSec: 60 });
  validateContext(context, config);

  const senderCredentials = await tokenProvider.issue({
    environment: context.environment,
    accountGroup: config.senderAccountGroup
  });

  await appBridge.startMetrics({ runId, scenarioId: config.scenario.id });
  const run = await runner.start({ runId, context, senderCredentials, scenario: config.scenario });

  try {
    await monitorUntilFinished(run, appBridge, device);
  } finally {
    await runner.stop(runId);
    await appBridge.stopMetrics(runId);
    await collectArtifacts(runId);
    await cleanupRoom(runId, context.roomId);
  }

  const report = await mergeAndEvaluate(runId);
  publishJUnit(report);
  return report.status;
}
```

## 三 同步与异常规则

| 异常 | 默认处理 | 结果 |
| --- | --- | --- |
| App 未进入房间 | 停止，不启动发送 | INVALID |
| 探针消息未收到 | 停止，保存通道日志 | INVALID |
| 发送实际 RPS 低于目标 | 继续收集诊断，但不做 App 性能门禁 | INVALID |
| App 崩溃或被杀 | 立即停止发送并收集 crash | FAIL |
| 设备断开 | 停止并保留部分报告 | INVALID |
| App 进入后台 | 停止，除非场景专门测试前后台 | INVALID |
| 热状态 serious 或 critical | 按测试规范停止或标记污染 | 默认 INVALID |
| 个别发送错误 | 错误率未超阈值则继续 | 由有效性门槛判断 |

# 十一 结果判定与报告

## 一 结果分类

- **PASS**：测试有效，所有绝对阈值和相对基线门禁通过。
- **FAIL**：测试有效，但 App 崩溃、性能指标、消息处理或恢复能力不满足门禁。
- **INVALID**：发送端、设备、房间、通道、时间同步或产物不满足测试有效性要求。

## 二 有效性门槛

以下初始门槛可配置，最终数值由性能负责人和 IM 平台共同确认。

| 项目 | 建议初始值 |
| --- | --- |
| 发送实际频率 | 稳定阶段 effective RPS 不低于目标的 95% |
| 发送成功率 | 不低于 99%，并且不能持续出现限流或断线 |
| 探针接收 | 开始前探针 100% 到达 |
| 数据完整性 | sender summary、device summary、两侧 events 均存在且 run_id 一致 |
| 设备状态 | 测试期间保持前台、不断连，热状态满足实验规范 |

## 三 性能门禁

首批版本先建立同设备同场景基线，再确定绝对阈值。建议门禁同时包含相对回归和业务底线。

| 指标 | 建议判定方式 |
| --- | --- |
| CPU | 稳定阶段 P95 相对基线版本的回归比例不超过配置值 |
| 内存 | max 不超过设备级阈值；稳定阶段斜率与恢复后残留不超过配置值 |
| FPS | P5、低 FPS 时间占比和场景目标帧率同时满足要求 |
| 卡顿 | 超过 100 和 250 毫秒的次数及总时长不超过门禁 |
| 接收率 | 按聊天室业务 QoS 定义，而不是直接假设 100%；App 入口后不允许无原因丢失 |
| 排队 | P95 等待和峰值不超过场景阈值，恢复阶段能在限定时间排空 |
| 礼物播放 | 接收、入队、播放和明确丢弃数量可对账；不能出现无限积压 |
| KV | 最终 value 与最高 version 一致，解析失败和乱序符合门禁 |

## 四 报告产物

| 文件 | 内容 |
| --- | --- |
| `run_manifest.json` | 设备、构建、场景、模板、房间、时间和版本信息 |
| `sender_events.jsonl` | 计划、尝试、ACK、失败和调度事件 |
| `device_metrics.jsonl` | 每秒 CPU、内存、FPS、卡顿、热状态和队列快照 |
| `message_events.jsonl` | App 端每条消息的接收、解析、排队、渲染和丢弃事件 |
| `summary.json` | 机器可读统计、阈值、状态和失败原因 |
| `report.html` | 时间序列图、分阶段统计、场景对比和错误明细 |
| `junit.xml` | CI 测试结果 |

## 五 汇总报告首页

报告首页至少展示运行状态、有效性、设备和构建信息、目标与实际 RPS、发送成功率、App 接收率、CPU P95、内存峰值与斜率、FPS P5、卡顿次数、各队列峰值、最长排队时长和恢复结果。INVALID 必须把无效原因置于性能指标之前，避免使用无效数据做版本结论。

# 十二 安全 稳定性与风险

## 一 安全要求

- 删除发送平台前端代码中的固定 Token，并轮换已经提交过的测试凭证。
- Token Provider 只向允许的 CI 身份和测试网络签发短期 Token。
- 日志中的 Token 只保留 hash 或首尾掩码；请求体、异常堆栈和命令行均不得输出原文。
- 测试桥仅在测试构建启用，使用一次性 secret，绑定本机接口或受控端口转发。
- 测试房间与账号和线上真实房间隔离，场景启动前校验 environment。

## 二 主要风险

| 风险 | 影响 | 缓解措施 |
| --- | --- | --- |
| 复用被测用户 Token | 连接互踢、自消息过滤、结果失真 | 独立 sender pool 和短期 Token |
| 房间走 Jaco only | Rong 消息无法到达 | 启动前读取 vendors；V1 拒绝，V2 增加 Jaco adapter |
| 发送端达不到 RPS | App 负载不足 | effective RPS 有效性门槛和 worker 扩展 |
| Mock 自动降级 | 零真实消息但流程继续 | 自动化强制 allowMock=false |
| 礼物资源缺失 | 未进入真实播放链路 | 场景前校验资源清单，冷缓存与热缓存分开 |
| 采集器自身开销 | 污染 CPU 和 FPS | 1 秒聚合、后台批量写、单独测量探针空载开销 |
| 时钟偏差 | 跨端延迟错误 | 开始前校验偏差，内部时长使用单调时钟 |
| 设备热降频 | 重复性下降 | 记录 thermalState，设置冷却间隔，异常测试置 INVALID |
| KV 覆盖语义 | 把中间状态缺失误判为丢包 | 使用 version，区分 superseded 与 dropped |
| 相同礼物自动合并 | 队列数量与发送数量不一致 | 分开定义聚合场景和独立排队场景 |

# 十三 实施计划与验收

## 一 分阶段交付

| 阶段 | 交付范围 | 完成条件 |
| --- | --- | --- |
| M1 协议与 Runner | dispatcher、client factory、scenario runner、CLI、发送报告 | 可在指定测试房间持续发送 600 秒并停止 |
| M2 iOS 测试桥与探针 | room ready、context、CPU、内存、FPS、卡顿、JSONL | 自动化可启动停止并取得完整设备摘要 |
| M3 消息队列埋点 | 公屏、通知、弹幕、礼物、KV 生命周期 | 目标消息可以在接收、入队、渲染各阶段对账 |
| M4 自动化编排 | 设备流程、探针验证、产物收集、清理 | 一条命令执行完整场景并生成 JUnit |
| M5 基线与门禁 | 场景校准、设备矩阵、阈值管理、趋势对比 | CI 能稳定识别性能回归和无效测试 |

## 二 角色分工

| 角色 | 负责内容 |
| --- | --- |
| IM 模拟器研发 | Runner、API、模板版本、发送统计、Token Provider 对接 |
| iOS 直播研发 | 测试桥、ready 信号、性能探针、消息和队列埋点 |
| 测试开发 | 设备编排、场景配置、报告合并、CI 门禁和异常清理 |
| IM 平台研发 | 测试账号池、Token 签发、限流说明、聊天室 QoS 口径 |
| 性能负责人 | 设备矩阵、实验条件、基线版本和阈值审批 |

## 三 V1 验收清单

1. 自动化能在物理 iPhone 上进入指定直播间并取得 room ready。
2. App 返回的 roomId 与 UI、Hub 和发送 Runner 一致。
3. Runner 使用独立发送账号连接并加入聊天室，自动化路径不会进入 Mock。
4. 公屏、弹幕、进场、普通礼物、全屏礼物和 KV 均能单独运行 600 秒。
5. 混合场景可以按独立 stream 同时调度，实际 RPS 满足有效性门槛。
6. iOS 每秒输出 CPU、内存、FPS、卡顿、热状态和队列深度。
7. 发送侧成功数与 App transport received 可以按 run_id 和 sequence 对账。
8. 弹幕 100 条上限、通知过期、公屏列表裁剪和礼物合并均有明确计数。
9. 全屏礼物输出排队 P95、播放时长 P95、积压峰值和恢复时间。
10. 测试中止、App 崩溃、设备断开和发送端不足均能正确停止和保存部分报告。
11. 最终生成 summary.json、report.html 和 junit.xml，CI 能识别 PASS、FAIL、INVALID。
12. 生产构建不暴露测试桥，所有报告和日志均不包含原始 Token。

## 四 评审待确认项

1. 生产峰值 P95 对应的各消息类型频率及 burst 持续时间。
2. 融云聊天室环境对单账号、单房间和 KV 的限流规则。
3. 测试账号池与 Token Provider 的归属和调用鉴权。
4. 自动化框架现有设备通道，决定使用 GCDWebServer 还是既有桥接协议。
5. 首批支持的物理设备型号、系统版本和刷新率组合。
6. CPU、内存、FPS、卡顿、接收率和恢复时长的最终门禁值。
7. 聊天室 QoS 下允许的消息丢弃口径，以及双通道房间的去重口径。
8. 全屏与 AR 礼物测试资源清单、授权方式和缓存清理方案。

# 附录 A 代码依据

| 主题 | 工程文件 |
| --- | --- |
| 融云连接与 IM KV 发送 | rc-im-simulator/src/utils/rcClient.js |
| 直播 IM 和 KV 模板 | rc-im-simulator/src/utils/liveTemplates.js |
| 当前页面批量发送 | rc-im-simulator/src/components/MessageSender.jsx |
| AppKey 与融云 Token | live-iOS/live/Const/ThirdConst.swift 和 live/Managers/RongManager.swift |
| 直播间加入与 ready 基础 | live-iOS/live/Modules/Live/LiveIm/viewModel/JacoLiveMessage/JacoLiveMessageViewModel+Internal.swift |
| 统一消息入口 | live-iOS/live/Modules/Live/LiveIm/viewModel/JacoLiveMessage/JacoLiveMessageViewModel+Message.swift |
| 消息分类和业务缓存 | live-iOS/live/Modules/Live/LiveIm/viewModel/LiveMessageManager.swift |
| 公屏列表 | live-iOS/live/Modules/Live/LiveIm/viewModel/LiveMessageListViewModel.swift |
| 弹幕队列 | live-iOS/live/Modules/Live/LiveRoom/Views/BulletComment/LiveBulletCommentView.swift |
| 全屏礼物队列 | live-iOS/live/Modules/Live/LiveRoom/Views/Foreground/EffectGift/LiveRoomEffectGiftView.swift |
| 全屏礼物播放操作 | live-iOS/live/Modules/Live/LiveRoom/Views/Foreground/EffectGift/LiveRoomEffectGiftOperation.swift |
| CPU 内存 FPS 卡顿 | live-iOS/live/Common/APM/Plugin 下对应插件 |

# 附录 B 术语

| 术语 | 定义 |
| --- | --- |
| DUT | Device Under Test，本次运行中的被测 iPhone 与 App |
| Runner | 执行场景并调用 IM 或 KV 发送的无界面运行器 |
| Orchestrator | 协调设备、App、Runner 和报告的自动化脚本 |
| Stream | 场景中的一个独立消息或 KV 发送流 |
| Target Count | 按场景计划应产生的消息数量 |
| Transport Received | 消息到达 App 统一 IM 入口的事件 |
| Queue Wait | 业务对象入队到开始展示之间的时间 |
| Drain | 停止发送后等待积压队列排空的阶段 |
| INVALID | 测试条件或负载未满足，结果不可用于判断 App 性能 |
