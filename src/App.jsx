import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IMProvider } from './store/imStore';
import ConfigPanel from './components/ConfigPanel';
import RoomPanel from './components/RoomPanel';
import MessageSender from './components/MessageSender';
import LogPanel from './components/LogPanel';
import {
  MIN_COMPOSE_WIDTH,
  MIN_LOG_WIDTH,
  clampComposeWidth,
  getDefaultComposeWidth,
} from './utils/panelSizing';
import './App.css';

const SETUP_PANEL_WIDTH = 440;
const RESIZE_HANDLE_WIDTH = 8;
const KEYBOARD_RESIZE_STEP = 16;

function HeaderTime() {
  const [t, setT] = useState('');
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="header-time">{t}</span>;
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className={`theme-toggle ${theme}`}
      onClick={onToggle}
      title={theme === 'dark' ? '切换至 Light 模式' : '切换至 Dark 模式'}
    >
      {theme === 'dark' ? (
        /* sun icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* moon icon */
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}

function App() {
  const mainRef = useRef(null);
  const dragStateRef = useRef(null);
  const availableWidthRef = useRef(0);
  const [composeWidth, setComposeWidth] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('rc-sim-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rc-sim-theme', theme);
  }, [theme]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;

    const updateAvailableWidth = () => {
      const availableWidth = Math.max(
        0,
        main.getBoundingClientRect().width - SETUP_PANEL_WIDTH - RESIZE_HANDLE_WIDTH,
      );
      availableWidthRef.current = availableWidth;
      setComposeWidth(currentWidth => (
        currentWidth === null
          ? getDefaultComposeWidth(availableWidth)
          : clampComposeWidth(availableWidth, currentWidth)
      ));
    };

    updateAvailableWidth();
    const observer = new ResizeObserver(updateAvailableWidth);
    observer.observe(main);
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const handleResizeStart = event => {
    if (composeWidth === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: composeWidth,
    };
    setIsResizing(true);
  };

  const handleResizeMove = event => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setComposeWidth(clampComposeWidth(
      availableWidthRef.current,
      dragState.startWidth + event.clientX - dragState.startX,
    ));
  };

  const handleResizeEnd = event => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizeKeyDown = event => {
    const availableWidth = availableWidthRef.current;
    const currentWidth = composeWidth ?? getDefaultComposeWidth(availableWidth);
    let requestedWidth;

    if (event.key === 'ArrowLeft') {
      requestedWidth = currentWidth - (event.shiftKey ? KEYBOARD_RESIZE_STEP * 3 : KEYBOARD_RESIZE_STEP);
    } else if (event.key === 'ArrowRight') {
      requestedWidth = currentWidth + (event.shiftKey ? KEYBOARD_RESIZE_STEP * 3 : KEYBOARD_RESIZE_STEP);
    } else if (event.key === 'Home') {
      requestedWidth = MIN_COMPOSE_WIDTH;
    } else if (event.key === 'End') {
      requestedWidth = availableWidth - MIN_LOG_WIDTH;
    } else {
      return;
    }

    event.preventDefault();
    setComposeWidth(clampComposeWidth(availableWidth, requestedWidth));
  };

  const separatorMaximum = Math.max(
    MIN_COMPOSE_WIDTH,
    availableWidthRef.current - MIN_LOG_WIDTH,
  );

  return (
    <IMProvider>
      <div className={`app-layout${isResizing ? ' is-resizing' : ''}`}>
        <header className="app-header">
          <div className="app-logo">
            <div className="logo-mark">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="5.5"/>
                <path d="M4.5 7h5M7 4.5v5"/>
              </svg>
            </div>
            <span className="logo-title">RongCloud IM Simulator</span>
            <span className="logo-sub">v1.0 · test env</span>
          </div>
          <div className="header-right">
            <HeaderTime />
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <span className="app-env-badge">TEST</span>
          </div>
        </header>

        <main
          ref={mainRef}
          className="app-main"
          style={composeWidth === null ? undefined : { '--compose-width': `${composeWidth}px` }}
        >
          {/* ① 连接 & 房间 —— 准备 */}
          <section className="col col-setup">
            <div className="col-head">
              <span className="col-step">1</span>
              <div className="col-head-text">
                <span className="col-title">连接 &amp; 房间</span>
                <span className="col-desc">配置凭据并加入会话</span>
              </div>
            </div>
            <div className="col-body col-body-scroll">
              <div className="stack-block">
                <ConfigPanel />
              </div>
              <div className="stack-block stack-block-grow">
                <RoomPanel />
              </div>
            </div>
          </section>

          {/* ② 消息编辑 —— 编排 */}
          <section className="col col-compose">
            <div className="col-head">
              <span className="col-step">2</span>
              <div className="col-head-text">
                <span className="col-title">消息编辑</span>
                <span className="col-desc">选择类型、编辑内容并下发</span>
              </div>
            </div>
            <div className="col-body">
              <MessageSender />
            </div>
          </section>

          <div
            className="panel-resizer"
            role="separator"
            aria-label="调整消息编辑与日志区域宽度"
            aria-orientation="vertical"
            aria-valuemin={MIN_COMPOSE_WIDTH}
            aria-valuemax={separatorMaximum}
            aria-valuenow={Math.round(composeWidth ?? MIN_COMPOSE_WIDTH)}
            tabIndex={0}
            title="拖拽调整宽度；方向键可微调"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            onPointerCancel={handleResizeEnd}
            onKeyDown={handleResizeKeyDown}
          >
            <span className="panel-resizer-grip" aria-hidden="true" />
          </div>

          {/* ③ 日志 —— 反馈 */}
          <section className="col col-log">
            <div className="col-head">
              <span className="col-step">3</span>
              <div className="col-head-text">
                <span className="col-title">下发日志</span>
                <span className="col-desc">实时结果与详情</span>
              </div>
            </div>
            <div className="col-body">
              <LogPanel />
            </div>
          </section>
        </main>
      </div>
    </IMProvider>
  );
}

export default App;
