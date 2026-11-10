import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type Keycloak from 'keycloak-js';
import { clearReturnTo, saveReturnTo } from './returnTo';

/**
 * Phần của keycloak-js mà ứng dụng dùng. Test truyền một đối tượng giả có đúng hình dạng này.
 */
export type KeycloakClient = Pick<
  Keycloak,
  | 'init'
  | 'login'
  | 'logout'
  | 'updateToken'
  | 'token'
  | 'tokenParsed'
  | 'onTokenExpired'
  | 'onAuthRefreshError'
  | 'onAuthLogout'
>;

export interface AuthUser {
  id?: string;
  username?: string;
  name?: string;
  email?: string;
}

/**
 * Trạng thái đăng nhập của SPA. Ứng dụng BẮT BUỘC đăng nhập: chưa có phiên thì chuyển thẳng sang
 * trang đăng nhập của Keycloak, người dùng không phải bấm nút.
 *  - loading: đang hỏi Keycloak (xử lý mã trả về hoặc chuyển hướng sang trang đăng nhập)
 *  - authenticated: đã có access token (CHỈ nằm trong bộ nhớ của keycloak-js, không ghi vào localStorage)
 *  - error: không liên lạc được Keycloak
 *
 * Mật khẩu không bao giờ đi qua SPA: đăng nhập là Authorization Code + PKCE S256 trên trang của Keycloak.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'error';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface AuthContextValue extends AuthState {
  logout: () => Promise<void>;
  getToken: () => Promise<string>;
  forceRefresh: () => Promise<boolean>;
  /** Phiên không còn hợp lệ: chuyển sang đăng nhập lại và quay về trang hiện tại. */
  expireSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const MIN_TOKEN_VALIDITY_SECONDS = 30;

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

function userOf(keycloak: KeycloakClient): AuthUser {
  const claims = (keycloak.tokenParsed ?? {}) as Record<string, string | undefined>;
  return {
    id: claims.sub,
    username: claims.preferred_username,
    name: claims.name || claims.preferred_username,
    email: claims.email,
  };
}

interface AuthProviderProps {
  keycloak: KeycloakClient;
  children: ReactNode;
  /** Chỉ để test; mặc định là window.location. */
  location?: Pick<Location, 'pathname' | 'search' | 'origin'>;
}

export function AuthProvider({ keycloak, children, location = window.location }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const initialization = useRef<Promise<boolean> | null>(null);
  const origin = location.origin;
  const callbackUrl = `${origin}/callback`;

  const redirectToLogin = useCallback(() => {
    // Nhớ trang đang xem để quay lại sau khi đăng nhập (chưa kể /callback).
    if (location.pathname !== '/callback') saveReturnTo(location.pathname + location.search);
    void keycloak.login({ redirectUri: callbackUrl });
  }, [keycloak, location, callbackUrl]);

  useEffect(() => {
    let active = true;
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(MIN_TOKEN_VALIDITY_SECONDS).catch(redirectToLogin);
    };
    keycloak.onAuthRefreshError = redirectToLogin;
    keycloak.onAuthLogout = redirectToLogin;

    // Nhớ trang đang xem TRƯỚC khi init: 'login-required' có thể chuyển hướng ngay trong init.
    if (location.pathname !== '/callback') saveReturnTo(location.pathname + location.search);

    // StrictMode chạy effect hai lần ở môi trường dev, nhưng Keycloak chỉ được init một lần.
    const initialized = (initialization.current ??= keycloak.init({
      onLoad: 'login-required', // chưa có phiên thì chuyển thẳng sang trang đăng nhập
      pkceMethod: 'S256',
      checkLoginIframe: false,
      redirectUri: callbackUrl,
    }));
    initialized
      .then((authenticated) => {
        if (active && authenticated) setState({ status: 'authenticated', user: userOf(keycloak) });
        // Chưa đăng nhập: keycloak-js đang chuyển hướng, giữ nguyên trạng thái loading.
      })
      .catch(() => {
        if (active) setState({ status: 'error', user: null });
      });
    return () => {
      active = false;
    };
  }, [keycloak, location, callbackUrl, redirectToLogin]);

  const logout = useCallback(() => {
    clearReturnTo();
    // Hủy phiên SSO ở Keycloak (kèm id_token_hint nếu có), rồi về "/": lúc đó chưa có phiên nên
    // ứng dụng lại chuyển sang trang đăng nhập.
    return keycloak.logout({ redirectUri: `${origin}/` });
  }, [keycloak, origin]);

  /** Trả access token còn hạn (làm mới nếu sắp hết). Phiên hết hạn thì ném SessionExpiredError. */
  const getToken = useCallback(async (): Promise<string> => {
    try {
      await keycloak.updateToken(MIN_TOKEN_VALIDITY_SECONDS);
    } catch {
      throw new SessionExpiredError();
    }
    if (!keycloak.token) throw new SessionExpiredError();
    return keycloak.token;
  }, [keycloak]);

  /** Ép làm mới ngay (dùng sau khi API trả 401). */
  const forceRefresh = useCallback(async (): Promise<boolean> => {
    try {
      return await keycloak.updateToken(-1);
    } catch {
      return false;
    }
  }, [keycloak]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, logout, getToken, forceRefresh, expireSession: redirectToLogin }),
    [state, logout, getToken, forceRefresh, redirectToLogin],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
