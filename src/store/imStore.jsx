import { createContext, useContext, useReducer, useRef } from 'react';

export const IMContext = createContext(null);

const initialState = {
  // 连接配置
  appKey: '',
  token: '',
  navServer: '',
  fileServer: '',
  connected: false,
  connecting: false,
  userId: '',
  // 房间列表
  rooms: [],
  activeRoom: null,
  // 消息日志
  logs: [],
  // 发送统计
  stats: { success: 0, failed: 0, total: 0 },
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, ...action.payload };
    case 'SET_CONNECTING':
      return { ...state, connecting: action.payload };
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload.connected, userId: action.payload.userId || state.userId, connecting: false };
    case 'ADD_ROOM':
      if (state.rooms.find(r => r.id === action.payload.id)) return state;
      return { ...state, rooms: [...state.rooms, action.payload] };
    case 'REMOVE_ROOM':
      return {
        ...state,
        rooms: state.rooms.filter(r => r.id !== action.payload),
        activeRoom: state.activeRoom === action.payload ? null : state.activeRoom,
      };
    case 'SET_ACTIVE_ROOM':
      return { ...state, activeRoom: action.payload };
    case 'ADD_LOG':
      return {
        ...state,
        logs: [action.payload, ...state.logs].slice(0, 500),
        stats: {
          total: state.stats.total + 1,
          success: action.payload.status === 'success' ? state.stats.success + 1 : state.stats.success,
          failed: action.payload.status === 'failed' ? state.stats.failed + 1 : state.stats.failed,
        },
      };
    case 'CLEAR_LOGS':
      return { ...state, logs: [], stats: { success: 0, failed: 0, total: 0 } };
    default:
      return state;
  }
}

export function IMProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const imClientRef = useRef(null);

  return (
    <IMContext.Provider value={{ state, dispatch, imClientRef }}>
      {children}
    </IMContext.Provider>
  );
}

export function useIM() {
  return useContext(IMContext);
}
