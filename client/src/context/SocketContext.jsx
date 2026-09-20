import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

// The API base URL includes a trailing /api (see api.js) but socket.io
// connects to the bare server origin, so strip it off here.
const SOCKET_URL = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

export function SocketProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setSocket(null);
      return;
    }

    // Auth is via the same httpOnly access_token cookie the REST API uses —
    // withCredentials lets the socket.io handshake send it along.
    const s = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [isLoggedIn]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
