import { useState } from 'react';
import { useIM } from '../store/imStore';
import { joinChatRoom, quitChatRoom } from '../utils/rcClient';
import { CONVERSATION_TYPES } from '../utils/messageTemplates';
import styles from './RoomPanel.module.css';

// 聊天室输入历史（localStorage 持久化，最多保留 10 条）
const HISTORY_KEY = 'rc_sim_chatroom_history';
const HISTORY_MAX = 10;
const loadHistory = () => {
  try { return (JSON.parse(localStorage.getItem(HISTORY_KEY)) || []).slice(0, HISTORY_MAX); }
  catch { return []; }
};
const saveHistory = (list) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch { /* ignore quota */ }
};

export default function RoomPanel() {
  const { state, dispatch } = useIM();
  const [roomId, setRoomId] = useState('');
  const [convType, setConvType] = useState(4); // 4 = CHATROOM（SDK ConversationType 枚举）
  const [joining, setJoining] = useState(false);
  const [history, setHistory] = useState(loadHistory);

  // 新增一条聊天室历史：去重、最新置顶、最多 10 条，超出裁剪
  const pushHistory = (id) => {
    setHistory(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
  };

  const removeHistory = (id) => {
    setHistory(prev => {
      const next = prev.filter(x => x !== id);
      saveHistory(next);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!roomId.trim()) return;
    const id = roomId.trim();
    const type = CONVERSATION_TYPES.find(t => t.value === convType);

    if (convType === 4 && state.connected) {
      setJoining(true);
      try {
        const result = await joinChatRoom(id, 50);
        if (result.code === 0) {
          pushHistory(id); // 仅记录聊天室输入历史
          dispatch({ type: 'ADD_ROOM', payload: { id, convType, label: type?.label } });
          dispatch({ type: 'SET_ACTIVE_ROOM', payload: id });
          dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'success', message: `join chatroom: ${id}` } });
        } else {
          dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'failed', message: `join failed [${result.code}]: ${id}` } });
        }
      } catch (e) {
        dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'failed', message: `join error: ${e.message}` } });
      }
      setJoining(false);
    } else {
      dispatch({ type: 'ADD_ROOM', payload: { id, convType, label: type?.label } });
      dispatch({ type: 'SET_ACTIVE_ROOM', payload: id });
    }
    setRoomId('');
  };

  const handleRemove = async (room) => {
    if (room.convType === 4 && state.connected) {
      try {
        await quitChatRoom(room.id);
        dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'success', message: `quit chatroom: ${room.id}` } });
      } catch {}
    }
    dispatch({ type: 'REMOVE_ROOM', payload: room.id });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>
        <span className={styles.titleDot} />
        Rooms
      </div>

      <div className={styles.addForm}>
        <div className={styles.addField}>
          <label className={styles.addLabel}>会话类型</label>
          <div className={styles.typeChips}>
            {CONVERSATION_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                className={`${styles.typeChip} ${convType === t.value ? styles.typeChipActive : ''}`}
                onClick={() => setConvType(t.value)}
                disabled={!state.connected}
              >
                <span className={styles.typeChipIcon}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.addField}>
          <label className={styles.addLabel}>房间 / 会话 ID</label>
          <div className={styles.addInputRow}>
            <input
              className={styles.input}
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              placeholder="room-id / user-id / group-id"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              disabled={!state.connected}
            />
            <button
              className={styles.btnAdd}
              onClick={handleAdd}
              disabled={!state.connected || !roomId.trim() || joining}
            >
              {joining ? (
                <>
                  <span className={styles.spinner} />
                  加入中
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3.5v9M3.5 8h9" />
                  </svg>
                  加入
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 聊天室输入历史（最多 10 条） */}
      {history.length > 0 && (
        <div className={styles.history}>
          <span className={styles.historyLabel}>最近聊天室</span>
          <div className={styles.historyChips}>
            {history.map(id => (
              <span key={id} className={styles.chip} title={id}>
                <span
                  className={styles.chipText}
                  onClick={() => setRoomId(id)}
                >{id}</span>
                <button
                  className={styles.chipRemove}
                  onClick={() => removeHistory(id)}
                  title="删除记录"
                >×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {!state.connected && (
        <div className={styles.tip}>connect first to add rooms</div>
      )}

      <div className={styles.list}>
        {state.rooms.length === 0 ? (
          <div className={styles.empty}>no rooms</div>
        ) : (
          state.rooms.map(room => {
            const typeInfo = CONVERSATION_TYPES.find(t => t.value === room.convType);
            return (
              <div
                key={room.id}
                className={`${styles.roomItem} ${state.activeRoom === room.id ? styles.active : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_ROOM', payload: room.id })}
              >
                <span className={styles.roomIcon}>{typeInfo?.icon || '💬'}</span>
                <div className={styles.roomInfo}>
                  <span className={styles.roomId}>{room.id}</span>
                  <span className={styles.roomType}>{typeInfo?.label}</span>
                </div>
                {state.activeRoom === room.id && <span className={styles.activeDot} />}
                <button
                  className={styles.btnRemove}
                  onClick={e => { e.stopPropagation(); handleRemove(room); }}
                  title="remove"
                >x</button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
