import { useState } from 'react';
import { useIM } from '../store/imStore';
import { initRCClientFull, connectRC, disconnectRC, parseToken } from '../utils/rcClient';
import styles from './ConfigPanel.module.css';

// 预置演示凭据（融云私有化测试环境 · userId=1300000077）
const DEMO_CREDENTIALS = {
  appKey: 'mgb7ka1nm8v4g',
  token: '8qRB+OsaRpcu911yWhcDR+9sJxxg4uFvwrRD4J2R71I=@em38.cn.rongnav.com;em38.cn.rongcfg.com',
};

export default function ConfigPanel() {
  const { state, dispatch } = useIM();
  const [form, setForm] = useState({
    appKey: state.appKey || '',
    token: state.token || '',
    navServer: state.navServer || '',
    fileServer: state.fileServer || '',
  });
  const [error, setError] = useState('');
  const [verifyStatus, setVerifyStatus] = useState(null); // null | 'running' | 'ok' | 'fail'
  const [verifyMsg, setVerifyMsg] = useState('');

  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // ── 一键填入演示凭据并自动连接 ────────────────────────────────────────
  const handleQuickVerify = async () => {
    if (state.connected || state.connecting) return;
    const next = { ...form, appKey: DEMO_CREDENTIALS.appKey, token: DEMO_CREDENTIALS.token };
    setForm(next);
    setVerifyStatus('running');
    setVerifyMsg('正在连接...');
    setError('');

    dispatch({ type: 'SET_CONNECTING', payload: true });
    dispatch({ type: 'SET_CONFIG', payload: { appKey: next.appKey, token: next.token, navServer: next.navServer, fileServer: next.fileServer } });

    try {
      const initResult = await initRCClientFull({ appKey: next.appKey, navServer: next.navServer, fileServer: next.fileServer, environment: 'private' });
      if (initResult.mock) {
        dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'system', message: '[WARN] 真实 SDK 加载失败，使用 Mock 模式。连接结果不代表真实环境。' } });
      }
      const result = await connectRC(next.token, { navServer: next.navServer, fileServer: next.fileServer, environment: 'private' });
      if (result.code === 0) {
        const { navInfo } = parseToken(next.token);
        const userId = result.data?.userId || result.data?.id || 'unknown';
        dispatch({ type: 'SET_CONNECTED', payload: { connected: true, userId } });
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'success',
            message: `[验证] connected · uid=${userId}${navInfo ? ` · nav=${navInfo}` : ''}`,
          },
        });
        setVerifyStatus('ok');
        setVerifyMsg(`连接成功 ✓  userId=${userId}`);
      } else {
        throw new Error(`code=${result.code}`);
      }
    } catch (e) {
      dispatch({ type: 'SET_CONNECTING', payload: false });
      setVerifyStatus('fail');
      setVerifyMsg(`连接失败：${e.message}`);
      setError(e.message);
      dispatch({
        type: 'ADD_LOG',
        payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'failed', message: `[验证] connect failed: ${e.message}` },
      });
    }
  };

  const handleConnect = async () => {
    if (!form.appKey) { setError('App Key 不能为空'); return; }
    if (!form.token) { setError('Token 不能为空'); return; }
    setError('');
    dispatch({ type: 'SET_CONNECTING', payload: true });
    dispatch({ type: 'SET_CONFIG', payload: { appKey: form.appKey, token: form.token, navServer: form.navServer, fileServer: form.fileServer } });

    try {
      // 保存 appKey，然后调用 connectRC（内部自动完成 init + connect）
      const initResult = await initRCClientFull({ appKey: form.appKey, navServer: form.navServer, fileServer: form.fileServer, environment: 'private' });
      if (initResult.mock) {
        dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'system', message: '[WARN] 真实 SDK 加载失败，使用 Mock 模式。连接结果不代表真实环境。' } });
      }
      const result = await connectRC(form.token, { navServer: form.navServer, fileServer: form.fileServer, environment: 'private' });
      if (result.code === 0) {
        const { navInfo } = parseToken(form.token);
        const userId = result.data?.userId || result.data?.id || 'user';
        dispatch({ type: 'SET_CONNECTED', payload: { connected: true, userId } });
        dispatch({
          type: 'ADD_LOG',
          payload: {
            id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'success',
            message: `connected · uid=${userId}${navInfo ? ` · nav=${navInfo}` : ''}`,
          },
        });
      } else {
        throw new Error(`连接失败 code=${result.code}`);
      }
    } catch (e) {
      dispatch({ type: 'SET_CONNECTING', payload: false });
      setError(e.message);
      dispatch({
        type: 'ADD_LOG',
        payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'failed', message: `connect failed: ${e.message}` },
      });
    }
  };

  const handleDisconnect = async () => {
    try { await disconnectRC(); } catch {}
    dispatch({ type: 'SET_CONNECTED', payload: { connected: false, userId: '' } });
    dispatch({ type: 'ADD_LOG', payload: { id: Date.now(), time: new Date().toISOString(), type: 'system', status: 'success', message: 'disconnected' } });
  };

  const { navInfo: navFromToken } = parseToken(form.token);

  const statusLabel = state.connected
    ? `connected`
    : state.connecting ? 'connecting...' : 'offline';

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>
          <span className={styles.titleDot} />
          Connection
        </span>
        <span className={`${styles.badge} ${state.connected ? styles.connected : state.connecting ? styles.connecting : styles.disconnected}`}>
          {statusLabel}
          {state.connected && state.userId && (
            <span className={styles.userId}> · {state.userId}</span>
          )}
        </span>
      </div>

      <div className={styles.hint}>
        <span className={styles.hintDot} />
        {navFromToken
          ? <>Token 含导航地址，已自动解析：<code style={{ color: 'var(--accent-text)', fontSize: 10 }}>{navFromToken}</code></>
          : '无真实 App Key 时自动启用 mock 模式；Token 可含 @nav 导航地址'}
      </div>

      {/* 快速验证横幅 */}
      <div className={styles.verifyBar}>
        <button
          className={styles.btnVerify}
          onClick={handleQuickVerify}
          disabled={state.connected || state.connecting || verifyStatus === 'running'}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 3L6.5 10 3.5 7"/><circle cx="8" cy="8" r="7"/>
          </svg>
          一键验证连接
        </button>
        {verifyStatus && (
          <span className={`${styles.verifyResult} ${styles['verify_' + verifyStatus]}`}>
            {verifyStatus === 'running' && (
              <span className={styles.spinner} />
            )}
            {verifyMsg}
          </span>
        )}
      </div>

      {/* App Key / Token：竖向堆叠、可选、可一键清空 */}
      <div className={styles.credStack}>
        <div className={styles.formItem}>
          <label>App Key <span className={styles.required}>*</span></label>
          <div className={styles.inputWrap}>
            <input
              type="text"
              value={form.appKey}
              onChange={e => handleChange('appKey', e.target.value)}
              placeholder="your-app-key"
              disabled={state.connected || state.connecting}
              className={styles.formInput}
            />
            {form.appKey && !(state.connected || state.connecting) && (
              <button type="button" className={styles.clearBtn} title="清空" onClick={() => handleChange('appKey', '')}>×</button>
            )}
          </div>
        </div>
        <div className={styles.formItem}>
          <label>Token <span className={styles.required}>*</span></label>
          <div className={styles.inputWrap}>
            <input
              type="text"
              value={form.token}
              onChange={e => handleChange('token', e.target.value)}
              placeholder="user-token"
              disabled={state.connected || state.connecting}
              className={styles.formInput}
            />
            {form.token && !(state.connected || state.connecting) && (
              <button type="button" className={styles.clearBtn} title="清空" onClick={() => handleChange('token', '')}>×</button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="5"/><line x1="6" y1="4" x2="6" y2="6.5"/><circle cx="6" cy="8.5" r="0.4" fill="currentColor"/>
          </svg>
          {error}
        </div>
      )}

      <div className={styles.actions}>
        {!state.connected ? (
          <button className={styles.btnConnect} onClick={handleConnect} disabled={state.connecting}>
            {state.connecting ? (
              <>
                <span className={styles.spinner} />
                connecting...
              </>
            ) : (
              'Connect'
            )}
          </button>
        ) : (
          <button className={styles.btnDisconnect} onClick={handleDisconnect}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
