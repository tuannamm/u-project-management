import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, SessionExpiredError, useAuth, type AuthContextValue, type KeycloakClient } from './AuthProvider';
import { ProtectedRoute } from './ProtectedRoute';
import { CallbackPage } from '../pages/CallbackPage';
import { saveReturnTo } from './returnTo';

const location = (pathname = '/', search = '') => ({ pathname, search, origin: 'http://localhost:3001' });

type FakeKeycloak = jest.Mocked<Pick<KeycloakClient, 'init' | 'login' | 'logout' | 'updateToken'>> &
  Pick<KeycloakClient, 'token' | 'tokenParsed' | 'onTokenExpired' | 'onAuthRefreshError' | 'onAuthLogout'>;

function fakeKeycloak({ init = Promise.resolve(true), token = 'access-token' }: { init?: Promise<boolean>; token?: string } = {}): FakeKeycloak {
  return {
    init: jest.fn().mockReturnValue(init),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    updateToken: jest.fn().mockResolvedValue(true),
    token,
    tokenParsed: { sub: 'u1', preferred_username: 'alice', name: 'Alice A' },
  } as unknown as FakeKeycloak;
}

let auth: AuthContextValue;
function Probe() {
  auth = useAuth();
  return <p>status:{auth.status}</p>;
}

interface RenderOptions {
  path?: string;
  search?: string;
  children?: ReactNode;
  strict?: boolean;
}

function renderProvider(keycloak: FakeKeycloak, { path = '/app', search = '', children = <Probe />, strict = false }: RenderOptions = {}) {
  const tree = (
    <AuthProvider keycloak={keycloak as unknown as KeycloakClient} location={location(path, search)}>
      <MemoryRouter initialEntries={[path + search]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </MemoryRouter>
    </AuthProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('AuthProvider', () => {
  it('goes straight to the Keycloak login page when there is no session (no button needed)', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak);
    await screen.findByText('status:authenticated');
    expect(keycloak.init).toHaveBeenCalledWith({
      onLoad: 'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
      redirectUri: 'http://localhost:3001/callback',
    });
  });

  it('stays in loading while keycloak-js redirects to the login page', async () => {
    renderProvider(fakeKeycloak({ init: new Promise<boolean>(() => undefined) }));
    expect(await screen.findByText('status:loading')).toBeInTheDocument();
  });

  it('exposes the signed-in user', async () => {
    renderProvider(fakeKeycloak());
    await screen.findByText('status:authenticated');
    expect(auth.user).toMatchObject({ username: 'alice', name: 'Alice A' });
  });

  it('remembers the page the user wanted before redirecting to login', async () => {
    renderProvider(fakeKeycloak({ init: new Promise<boolean>(() => undefined) }), { path: '/app/projects', search: '?tab=a' });
    await screen.findByText('status:loading');
    expect(sessionStorage.getItem('pm.return-to')).toBe('/app/projects?tab=a');
  });

  it('does not overwrite the remembered page when it comes back on /callback', async () => {
    saveReturnTo('/app/projects');
    renderProvider(fakeKeycloak(), { path: '/callback' });
    await screen.findByText('status:authenticated');
    expect(sessionStorage.getItem('pm.return-to')).toBe('/app/projects');
  });

  it('reports an error when Keycloak cannot be reached', async () => {
    renderProvider(fakeKeycloak({ init: Promise.reject(new Error('network')) }));
    await screen.findByText('status:error');
  });

  it('initialises Keycloak only once under StrictMode', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak, { strict: true });
    await screen.findByText('status:authenticated');
    expect(keycloak.init).toHaveBeenCalledTimes(1);
  });

  it('logout() ends the Keycloak session and returns to the root', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak);
    await screen.findByText('status:authenticated');
    saveReturnTo('/app/x');
    await act(() => auth.logout());
    expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: 'http://localhost:3001/' });
    expect(sessionStorage.getItem('pm.return-to')).toBeNull();
  });

  it('getToken() refreshes near expiry and throws SessionExpiredError when it cannot', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak);
    await screen.findByText('status:authenticated');
    await expect(auth.getToken()).resolves.toBe('access-token');
    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    keycloak.updateToken.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(auth.getToken()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('sends the user back to the login page when the session can no longer be refreshed', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak, { path: '/app/projects' });
    await screen.findByText('status:authenticated');
    act(() => keycloak.onAuthRefreshError?.());
    expect(keycloak.login).toHaveBeenCalledWith({ redirectUri: 'http://localhost:3001/callback' });
    expect(sessionStorage.getItem('pm.return-to')).toBe('/app/projects');
  });

  it('expireSession() (used after a repeated 401) also goes to the login page', async () => {
    const keycloak = fakeKeycloak();
    renderProvider(keycloak);
    await screen.findByText('status:authenticated');
    act(() => auth.expireSession());
    expect(keycloak.login).toHaveBeenCalledTimes(1);
  });
});

describe('ProtectedRoute', () => {
  const protectedTree = (
    <Routes>
      <Route path="/app/*" element={<ProtectedRoute><p>secret page</p></ProtectedRoute>} />
    </Routes>
  );

  it('shows a waiting message while redirecting and hides the page', async () => {
    renderProvider(fakeKeycloak({ init: new Promise<boolean>(() => undefined) }), { children: protectedTree });
    expect(await screen.findByText('Đang chuyển tới trang đăng nhập…')).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('renders the page for an authenticated user', async () => {
    renderProvider(fakeKeycloak(), { children: protectedTree });
    await screen.findByText('secret page');
  });

  it('offers a retry when Keycloak is unreachable', async () => {
    renderProvider(fakeKeycloak({ init: Promise.reject(new Error('down')) }), { children: protectedTree });
    expect(await screen.findByText('Không kết nối được máy chủ đăng nhập')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });
});

describe('routing after login', () => {
  const tree = (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route path="/app/projects" element={<p>projects page</p>} />
      <Route path="/app" element={<p>app page</p>} />
    </Routes>
  );

  it('returns the user to the page they came from after a successful login', async () => {
    saveReturnTo('/app/projects');
    renderProvider(fakeKeycloak(), { path: '/callback', children: tree });
    await screen.findByText('projects page');
  });

  it('shows the app when the root is opened by a signed-in user', async () => {
    renderProvider(fakeKeycloak(), { path: '/', children: tree });
    await waitFor(() => expect(screen.getByText('app page')).toBeInTheDocument());
  });

  it('shows an error on /callback when the login could not be completed', async () => {
    renderProvider(fakeKeycloak({ init: Promise.reject(new Error('bad code')) }), { path: '/callback', children: tree });
    expect(await screen.findByRole('alert')).toHaveTextContent('Không hoàn tất được đăng nhập');
  });
});
