import { Link, Navigate, Route, Routes } from 'react-router-dom';
import './components/kit/theme.css';
import './components/kit/button.css';
import './App.css';
import { useAuth } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AccessManagementPage } from './pages/AccessManagementPage';
import { CallbackPage } from './pages/CallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/ForbiddenPage';
import { CreateUserPage } from './pages/CreateUserPage';
import { UserDetailPage } from './pages/UserDetailPage';
import { UsersPage } from './pages/UsersPage';
import { Can, PermissionsProvider } from './permissions/PermissionsProvider';
import { RequirePermission } from './permissions/RequirePermission';

function Header() {
  const { status, user, logout } = useAuth();
  return (
    <header className="top">
      <Link to="/app" className="brand">
        Project Management
      </Link>
      <nav aria-label="Tài khoản">
        {status === 'authenticated' && (
          <>
            <Can permission="users:read">
              <Link to="/users">Người dùng</Link>
            </Can>
            <Can permission="roles:read"><Link to="/roles">Vai trò</Link></Can>
            <Can permission="permissions:read"><Link to="/permissions">Quyền hạn</Link></Can>
            <span>{user?.name}</span>
            <button type="button" className="btn" onClick={() => void logout()}>
              Đăng xuất
            </button>
          </>
        )}
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <PermissionsProvider>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <RequirePermission permission="users:read">
                  <UsersPage />
                </RequirePermission>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/new"
            element={
              <ProtectedRoute>
                <RequirePermission permission="users:write">
                  <CreateUserPage />
                </RequirePermission>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <RequirePermission permission="users:read">
                  <UserDetailPage />
                </RequirePermission>
              </ProtectedRoute>
            }
          />
          <Route path="/roles" element={<ProtectedRoute><RequirePermission permission="roles:read"><AccessManagementPage mode="roles" /></RequirePermission></ProtectedRoute>} />
          <Route path="/permissions" element={<ProtectedRoute><RequirePermission permission="permissions:read"><AccessManagementPage mode="permissions" /></RequirePermission></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </PermissionsProvider>
  );
}
