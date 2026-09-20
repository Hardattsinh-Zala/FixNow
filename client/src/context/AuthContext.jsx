import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api';

const AuthContext = createContext(null);

// sessionStorage key — stores only a non-sensitive "session exists" hint.
// This is NOT the token. The actual token is in an httpOnly cookie.
const SESSION_KEY = 'ss_session';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const initDone = useRef(false); // prevent double-run in StrictMode

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/user');
      setUser(res.data);
      sessionStorage.setItem(SESSION_KEY, '1'); // mark session as active
      return res.data;
    } catch {
      setUser(null);
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
  }, []);

  // On mount — restore session without triggering the refresh interceptor loop.
  // Strategy:
  //   - If no session hint → user is definitely logged out, skip server call entirely.
  //   - If session hint exists → access token may have expired, so call /refresh first
  //     (using the long-lived refresh cookie), thn fetch user once with the new token.
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const hasSession = sessionStorage.getItem(SESSION_KEY);

    if (!hasSession) {
      // Definitely no session — skip all network calls
      setLoading(false);
      return;
    }

    // Session hint exists — try to get a fresh access token then load user.
    // We call /refresh directly here (not through the interceptor) to avoid the loop.
    api.post('/refresh')
      .then(() => fetchUser())
      .catch(() => {
        // Refresh token also expired — full logout
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [fetchUser]);

  // Called after login/register — cookies already set by server, just load user
  const login = useCallback(async () => {
    const fullUser = await fetchUser();
    return fullUser;
  }, [fetchUser]);

  // Clear cookies server-side and wipe session hint
  const logout = useCallback(async () => {
    try { await api.post('/logout'); } catch { /* ignore network errors */ }
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const refreshUser = useCallback(() => fetchUser(), [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, login, logout, refreshUser }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
