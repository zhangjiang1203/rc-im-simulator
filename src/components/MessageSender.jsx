import { useState, useMemo } from 'react';
import { useIM } from '../store/imStore';
import { sendIMMessage, setChatRoomKV } from '../utils/rcClient';
import { MESSAGE_TYPES, QUICK_TEMPLATES, CONVERSATION_TYPES } from '../utils/messageTemplates';
import {
  LIVE_IM_TEMPLATES, LIVE_KV_TEMPLATES, groupTemplates, buildIMContent, buildKVValue,
} from '../utils/liveTemplates';
import JsonEditor from './JsonEditor';
import styles from './MessageSender.module.css';

/** 普通字段渲染（基础消息的非 JSON textarea 走这里） */
function FieldInput({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        className={styles.textarea}
        value={value || ''}
        onChange={e => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        rows={4}
      />
    );
  }
  return (
    <input
      type={field.type || 'text'}
      className={styles.input}
      value={value || ''}
      onChange={e => onChange(field.key, e.target.value)}
      placeholder={field.placeholder}
    />
  );
}

const IM_LIVE_GROUPS = groupTemplates(LIVE_IM_TEMPLATES);
const KV_GROUPS = groupTemplates(LIVE_KV_TEMPLATES);
const prettifyTemplate = (t) => JSON.stringify(t.template, null, 2);

export default function MessageSender() {
  const { state, dispatch } = useIM();

  // 下发通道：im（融云消息）/ kv（聊天室属性）
  const [channel, setChannel] = useState('im');

  // IM：基础消息用 basic:<objectName>，直播自定义消息用模板 id
  const [imSelId, setImSelId] = useState(`basic:${MESSAGE_TYPES[0].value}`);
  const [fieldValues, setFieldValues] = useState(MESSAGE_TYPES[0].defaultValues || {});

  // KV：选中的 KV 模板 id + 下发选项
  const [kvSelId, setKvSelId] = useState(LIVE_KV_TEMPLATES[0].id);
  const [kvForce, setKvForce] = useState(false);
  const [kvNotify, setKvNotify] = useState(false);
  const [kvAutoDelete, setKvAutoDelete] = useState(false);

  // 直播 IM / KV 共用的 JSON 编辑器文本
  const [jsonText, setJsonText] = useState('');

  const [sending, setSending] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [batchInterval, setBatchInterval] = useState(500);

  const activeRoomInfo = state.rooms.find(r => r.id === state.activeRoom);
  const convTypeInfo = activeRoomInfo ? CONVERSATION_TYPES.find(t => t.value === activeRoomInfo.convType) : null;

  // 当前 IM 选择解析
  const isBasic = imSelId.startsWith('basic:');
  const basicType = isBasic ? MESSAGE_TYPES.find(t => `basic:${t.value}` === imSelId) : null;
  const liveTmpl = !isBasic ? LIVE_IM_TEMPLATES.find(t => t.id === imSelId) : null;
  const kvTmpl = useMemo(() => LIVE_KV_TEMPLATES.find(t => t.id === kvSelId), [kvSelId]);

  const handleFieldChange = (key, val) => setFieldValues(prev => ({ ...prev, [key]: val }));

  // —— 选择切换：选中模板即把 JSON 结构灌入编辑器 ——
  const selectImOption = (id) => {
    setImSelId(id);
    if (id.startsWith('basic:')) {
      const t = MESSAGE_TYPES.find(x => `basic:${x.value}` === id);
      setFieldValues(t?.defaultValues || {});
    } else {
      const t = LIVE_IM_TEMPLATES.find(x => x.id === id);
      if (t) setJsonText(prettifyTemplate(t));
    }
  };

  const selectKvOption = (id) => {
    setKvSelId(id);
    const t = LIVE_KV_TEMPLATES.find(x => x.id === id);
    if (t) setJsonText(prettifyTemplate(t));
  };

  const switchChannel = (ch) => {
    setChannel(ch);
    if (ch === 'kv') {
      const t = LIVE_KV_TEMPLATES.find(x => x.id === kvSelId) || LIVE_KV_TEMPLATES[0];
      setJsonText(prettifyTemplate(t));
    } else if (!imSelId.startsWith('basic:')) {
      const t = LIVE_IM_TEMPLATES.find(x => x.id === imSelId);
      if (t) setJsonText(prettifyTemplate(t));
    }
  };

  const resetTemplate = () => {
    if (channel === 'kv' && kvTmpl) setJsonText(prettifyTemplate(kvTmpl));
    else if (liveTmpl) setJsonText(prettifyTemplate(liveTmpl));
  };

  const handleQuickTemplate = (tmpl) => {
    setChannel('im');
    const typeObj = MESSAGE_TYPES.find(t => t.value === tmpl.type) || MESSAGE_TYPES.find(t => t.value === 'custom');
    setImSelId(`basic:${typeObj.value}`);
    if (tmpl.type === 'custom') {
      setFieldValues({ customType: tmpl.customType, contentJson: JSON.stringify(tmpl.content, null, 2) });
    } else {
      const v = {};
      Object.entries(tmpl.content).forEach(([k, val]) => {
        v[k] = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
      });
      setFieldValues(v);
    }
  };

  const addLog = (payload) => dispatch({
    type: 'ADD_LOG',
    payload: { id: Date.now() + Math.random(), time: new Date().toISOString(), ...payload },
  });

  // —— 单次下发 ——
  const doSend = async () => {
    const targetId = state.activeRoom;
    const conversationType = activeRoomInfo?.convType ?? 4;

    // KV 通道
    if (channel === 'kv') {
      if (!kvTmpl) return false;
      let value;
      try {
        value = buildKVValue(kvTmpl, jsonText);
      } catch (e) {
        addLog({ type: `KV:${kvTmpl.key}`, roomId: targetId, status: 'failed', message: `JSON 解析失败: ${e.message}` });
        return false;
      }
      try {
        const result = await setChatRoomKV({ targetId, key: kvTmpl.key, value, isSendNotification: kvNotify, isAutoDelete: kvAutoDelete, force: kvForce });
        const ok = result.code === 0;
        addLog({
          type: `KV:${kvTmpl.key}`, roomId: targetId, convType: conversationType,
          status: ok ? 'success' : 'failed',
          message: ok ? `KV ${kvTmpl.key} -> ${targetId}${kvForce ? ' (force)' : ''}` : `[${result.code}] KV ${kvTmpl.key}`,
          content: { key: kvTmpl.key, value },
        });
        return ok;
      } catch (e) {
        addLog({ type: `KV:${kvTmpl.key}`, roomId: targetId, status: 'failed', message: `error: ${e.message}`, content: { key: kvTmpl.key, value } });
        return false;
      }
    }

    // IM 通道 —— 组装 messageType + content
    let messageType, content;
    try {
      if (isBasic) {
        messageType = basicType.getMessageType ? basicType.getMessageType(fieldValues) : basicType.value;
        content = basicType.buildContent(fieldValues);
      } else {
        ({ messageType, content } = buildIMContent(liveTmpl, jsonText));
      }
    } catch (e) {
      addLog({ type: liveTmpl?.objectName || 'IM', roomId: targetId, status: 'failed', message: `JSON 解析失败: ${e.message}` });
      return false;
    }

    try {
      const result = await sendIMMessage({ conversationType, targetId, messageType, content });
      const ok = result.code === 0;
      addLog({
        type: messageType, roomId: targetId, convType: conversationType,
        status: ok ? 'success' : 'failed',
        message: ok ? `${messageType} -> ${targetId}` : `[${result.code}] ${messageType} -> ${targetId}`,
        content,
        msgUid: result.data?.messageUId || result.data?.messageId || '',
      });
      return ok;
    } catch (e) {
      addLog({ type: messageType, roomId: targetId, status: 'failed', message: `error: ${e.message}`, content });
      return false;
    }
  };

  const handleSend = async () => {
    if (!state.connected || !state.activeRoom) return;
    setSending(true);
    if (batchCount <= 1) {
      await doSend();
    } else {
      for (let i = 0; i < batchCount; i++) {
        await doSend();
        if (i < batchCount - 1) await new Promise(r => setTimeout(r, batchInterval));
      }
    }
    setSending(false);
  };

  const isJsonField = (field) => field.key === 'contentJson' || field.isJson;

  const showJsonEditor = channel === 'kv' || (channel === 'im' && !isBasic);
  const editorHint = channel === 'kv'
    ? (kvTmpl?.rawValue ? 'value 为纯数字/字符串，将直接作为 KV value 下发' : 'value 将被 JSON.stringify 后作为 KV value 下发')
    : (liveTmpl?.wrapAsLiveCustom ? '下发时自动包一层 Live:Custom（content 为内层 JSON 字符串）' : `直接作为 ${liveTmpl?.objectName} 的 content 下发`);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>
          <span className={styles.titleDot} />
          Message Sender
        </span>
        {activeRoomInfo ? (
          <span className={styles.targetBadge}>
            <span className={styles.targetDot} />
            {convTypeInfo?.label} · {activeRoomInfo.id}
          </span>
        ) : (
          <span className={styles.noTarget}>no room selected</span>
        )}
      </div>

      {/* ── 下发通道：IM 消息 / KV 消息 ── */}
      <div className={styles.channelTabs}>
        <button
          className={`${styles.channelTab} ${channel === 'im' ? styles.channelTabActive : ''}`}
          onClick={() => switchChannel('im')}
        >💬 IM 消息</button>
        <button
          className={`${styles.channelTab} ${channel === 'kv' ? styles.channelTabActive : ''}`}
          onClick={() => switchChannel('kv')}
        >🗝️ KV 消息</button>
      </div>

      {/* ── 消息/KV 类型选择器 ── */}
      {channel === 'im' ? (
        <div className={styles.selectRow}>
          <label className={styles.selectLabel}>消息类型</label>
          <select className={styles.select} value={imSelId} onChange={e => selectImOption(e.target.value)}>
            <optgroup label="基础消息">
              {MESSAGE_TYPES.map(t => (
                <option key={t.value} value={`basic:${t.value}`}>{t.icon} {t.label}</option>
              ))}
            </optgroup>
            {IM_LIVE_GROUPS.map(g => (
              <optgroup key={g.group} label={`直播·${g.group}`}>
                {g.items.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      ) : (
        <div className={styles.selectRow}>
          <label className={styles.selectLabel}>KV 类型</label>
          <select className={styles.select} value={kvSelId} onChange={e => selectKvOption(e.target.value)}>
            {KV_GROUPS.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {/* Quick templates（仅 IM 通道展示） */}
      {channel === 'im' && (
        <div className={styles.quickRow}>
          <span className={styles.quickLabel}>Templates</span>
          <div className={styles.quickBtns}>
            {QUICK_TEMPLATES.map((tmpl, i) => (
              <button key={i} className={styles.quickBtn} onClick={() => handleQuickTemplate(tmpl)}>
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.fields}>
          {/* 基础消息：字段表单 */}
          {channel === 'im' && isBasic && basicType.fields.map(field => (
            <div key={field.key} className={styles.fieldItem}>
              <label className={styles.fieldLabel}>
                {field.label}
                {field.required && <span className={styles.required}> *</span>}
              </label>
              {isJsonField(field) ? (
                <JsonEditor
                  value={fieldValues[field.key] || ''}
                  onChange={val => handleFieldChange(field.key, val)}
                  placeholder={field.placeholder || '{\n  "key": "value"\n}'}
                  rows={8}
                />
              ) : (
                <FieldInput field={field} value={fieldValues[field.key]} onChange={handleFieldChange} />
              )}
            </div>
          ))}

          {/* 直播 IM / KV：JSON 结构编辑器 */}
          {showJsonEditor && (
            <div className={styles.fieldItem}>
              <div className={styles.editorHead}>
                <label className={styles.fieldLabel}>
                  {channel === 'kv' ? `KV value（${kvTmpl?.key}）` : `消息数据（${liveTmpl?.objectName}）`}
                </label>
                <button className={styles.resetBtn} onClick={resetTemplate} title="恢复为模板默认值">↺ 重置模板</button>
              </div>
              {channel === 'im' && liveTmpl?.subTypeHint && (
                <div className={styles.subHint}>sub_type: {liveTmpl.subTypeHint}</div>
              )}
              <JsonEditor
                value={jsonText}
                onChange={setJsonText}
                placeholder={'{\n  "key": "value"\n}'}
                rows={12}
              />
              <div className={styles.editorNote}>{editorHint}</div>

              {/* KV 下发选项 */}
              {channel === 'kv' && (
                <div className={styles.kvOptions}>
                  <label className={styles.kvOpt}>
                    <input type="checkbox" checked={kvForce} onChange={e => setKvForce(e.target.checked)} />
                    强制设置 (force)
                  </label>
                  <label className={styles.kvOpt}>
                    <input type="checkbox" checked={kvNotify} onChange={e => setKvNotify(e.target.checked)} />
                    发送通知 (isSendNotification)
                  </label>
                  <label className={styles.kvOpt}>
                    <input type="checkbox" checked={kvAutoDelete} onChange={e => setKvAutoDelete(e.target.checked)} />
                    退出自动删除 (isAutoDelete)
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Batch + Send row */}
        <div className={styles.sendRow}>
          <div className={styles.batchGroup}>
            <div className={styles.batchItem}>
              <label>Count</label>
              <input type="number" min={1} max={100000} value={batchCount}
                onChange={e => setBatchCount(Math.max(1, Math.min(100000, Number(e.target.value))))}
                className={styles.batchInput} />
            </div>
            <div className={styles.batchItem}>
              <label>Interval ms</label>
              <input type="number" min={100} max={10000} step={100} value={batchInterval}
                onChange={e => setBatchInterval(Math.max(100, Number(e.target.value)))}
                className={styles.batchInput} />
            </div>
            <span className={styles.batchNote}>
              {batchCount > 1 ? `×${batchCount} @ ${batchInterval}ms` : 'single shot'}
            </span>
          </div>

          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!state.connected || !state.activeRoom || sending}
          >
            {sending ? (
              <>
                <span className={styles.spinner} />
                SENDING...
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {channel === 'kv' ? 'SET KV' : 'SEND'}{batchCount > 1 ? ` ×${batchCount}` : ''}
              </>
            )}
          </button>
        </div>

        {!state.connected && <div className={styles.warn}>not connected — configure connection first</div>}
        {state.connected && !state.activeRoom && <div className={styles.warn}>no room selected</div>}
      </div>
    </div>
  );
}
