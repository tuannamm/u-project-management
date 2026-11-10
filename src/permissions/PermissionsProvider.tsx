import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from '../api/apiClient';
import { config } from '../config';
import { useAuth } from '../auth/AuthProvider';

/** Role như gateway trả về (schema Role trong OpenAPI); UI chỉ cần tên. */
export interface RoleInfo {
  name: string;
}

/** Phản hồi của GET /me/permissions (schema Access). */
export interface AccessResponse {
  userId: string;
  role: RoleInfo | null;
  permissions: string[];
}

type PermissionsState =
  | { status: 'idle' | 'loading'; role: RoleInfo | null; permissions: ReadonlySet<string> }
  | { status: 'ready'; role: RoleInfo | null; permissions: ReadonlySet<string> }
  | { status: 'error'; role: null; permissions: ReadonlySet<string>; error: unknown };

export interface PermissionsContextValue {
  status: PermissionsState['status'];
  role: RoleInfo | null;
  permissions: ReadonlySet<string>;
  api: ApiClient;
  refresh: () => void;
  can: (permission: string) => boolean;
}

/**
 * Quyền của người dùng hiện tại, lấy từ GET /me/permissions sau khi đăng nhập.
 * CHỈ để quyết định hiển thị: gateway và service mới là nơi chặn thật.
 */
const PermissionsContext = createContext<PermissionsContextValue | null>(null);
const IDLE: PermissionsState = { status: 'idle', role: null, permissions: new Set() };

interface PermissionsProviderProps {
  children: ReactNode;
  /** Chỉ để test. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export function PermissionsProvider({ children, fetchImpl, baseUrl = config.apiUrl }: PermissionsProviderProps) {
  const { status, getToken, forceRefresh, expireSession } = useAuth();
  const [state, setState] = useState<PermissionsState>(IDLE);
  const [version, setVersion] = useState(0);

  // Quyền có thể đổi (độ trễ tối đa một TTL cache ở gateway): tải lại khi gặp 403.
  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  const api = useMemo(
    () =>
      createApiClient({
        baseUrl,
        getToken,
        forceRefresh,
        onUnauthorized: expireSession,
        onForbidden: refresh,
        fetchImpl,
      }),
    [baseUrl, getToken, forceRefresh, expireSession, refresh, fetchImpl],
  );

  useEffect(() => {
    if (status !== 'authenticated') {
      setState(IDLE);
      return undefined;
    }
    let active = true;
    setState((current) => (current.status === 'error' ? IDLE : { ...current, status: 'loading' }));
    api
      .get<AccessResponse>('/me/permissions')
      .then((access) => {
        if (active) {
          setState({ status: 'ready', role: access.role ?? null, permissions: new Set(access.permissions ?? []) });
        }
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', role: null, permissions: new Set(), error });
      });
    return () => {
      active = false;
    };
    // `api` được tạo lại khi các callback đổi nên chỉ phụ thuộc status và version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, version]);

  const value = useMemo<PermissionsContextValue>(
    () => ({
      status: state.status,
      role: state.role,
      permissions: state.permissions,
      api,
      refresh,
      can: (permission) => state.permissions.has(permission),
    }),
    [state, api, refresh],
  );
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsContextValue {
  const value = useContext(PermissionsContext);
  if (!value) throw new Error('usePermissions must be used inside <PermissionsProvider>');
  return value;
}

export const useCan = (permission: string): boolean => usePermissions().can(permission);

/** Ẩn phần giao diện khi thiếu permission. Không phải bảo mật. */
export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <>{useCan(permission) ? children : fallback}</>;
}
