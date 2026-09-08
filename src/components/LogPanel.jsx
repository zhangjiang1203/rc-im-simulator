import { useState, useRef, useEffect } from 'react';
import { useIM } from '../store/imStore';
import styles from './LogPanel.module.css';

const STATUS_ICON = { success: '✓', failed: '✗', system: '·' };
const STATUS_CLASS = { success: 'success', failed: 'failed', system: 'system' };

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
  } catch { return iso; }
}

function LogItem({ log, expanded, onToggle }) {
  return (
    <div className={`${styles.logItem} ${styles[STATUS_CLASS[log.status] || 'system']}`}>
      <div className={styles.logHeader} onClick={onToggle}>
        <span className={styles.logTime}>{formatTime(log.time)}</span>
        <span className={styles.logStatusIcon}>{STATUS_ICON[log.status] || '·'}</span>
        <span className={styles.logMsg}>{log.message}</span>
        {log.content && (
          <span className={styles.logToggle}>{expanded ? '[-]' : '[+]'}</span>
        )}
      </div>
      {expanded && log.content && (
        <pre className={styles.logDetail}>{JSON.stringify(log.content, null, 2)}</pre>
      )}
    </div>
  );
}

export default function LogPanel() {
  const { state, dispatch } = useIM();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef(null);
  // 用户向下滚动查看历史时暂停置顶吸附，滚回顶部后恢复
  const pausedRef = useRef(false);

  const filteredLogs = state.logs.filter(log => {
    if (filter === 'success' && log.status !== 'success') return false;
    if (filter === 'failed' && log.status !== 'failed') return false;
    if (filter === 'system' && log.type !== 'system') return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  useEffect(() => {
    if (autoScroll && !pausedRef.current && listRef.current) listRef.current.scrollTop = 0;
  }, [state.logs.length, autoScroll]);

  const handleListScroll = () => {
    const el = listRef.current;
    if (el) pausedRef.current = el.scrollTop > 4;
  };

  const handleAutoScrollChange = (checked) => {
    setAutoScroll(checked);
    if (checked) {
      pausedRef.current = false;
      if (listRef.current) listRef.current.scrollTop = 0;
    }
  };

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(state.logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `im_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.panel}>
      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.statItem}>
          <span className={styles.statNum}>{state.stats.total}</span>
          <span className={styles.statLabel}>total</span>
        </div>
        <div className={`${styles.statItem} ${styles.statSuccess}`}>
          <span className={styles.statNum}>{state.stats.success}</span>
          <span className={styles.statLabel}>ok</span>
        </div>
        <div className={`${styles.statItem} ${styles.statFailed}`}>
          <span className={styles.statNum}>{state.stats.failed}</span>
          <span className={styles.statLabel}>err</span>
        </div>
        <div className={styles.statActions}>
          <button className={styles.actionBtn} onClick={handleExport}>export</button>
          <button className={styles.actionBtn} onClick={() => dispatch({ type: 'CLEAR_LOGS' })}>clear</button>
          <label className={styles.autoScrollLabel}>
            <input type="checkbox" checked={autoScroll} onChange={e => handleAutoScrollChange(e.target.checked)} />
            auto-scroll
          </label>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {[
            { value: 'all', label: 'ALL' },
            { value: 'success', label: 'OK' },
            { value: 'failed', label: 'ERR' },
            { value: 'system', label: 'SYS' },
          ].map(f => (
            <button
              key={f.value}
              className={`${styles.filterBtn} ${filter === f.value ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Log entries */}
      <div className={styles.logList} ref={listRef} onScroll={handleListScroll}>
        {filteredLogs.length === 0 ? (
          <div className={styles.empty}>no logs yet</div>
        ) : (
          filteredLogs.map(log => (
            <LogItem
              key={log.id}
              log={log}
              expanded={expandedIds.has(log.id)}
              onToggle={() => toggleExpand(log.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
