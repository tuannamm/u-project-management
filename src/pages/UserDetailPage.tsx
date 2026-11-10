import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  errorMessage,
  identityApi,
  type UserAccount,
  type RoleSummary,
} from '../api/identityApi';
import { usePermissions } from '../permissions/PermissionsProvider';
import { useAuth } from '../auth/AuthProvider';

/** Chi tiết user: sửa hồ sơ, đổi role, khóa/mở khóa, gửi email đặt lại mật khẩu. */
export function UserDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const { user: me } = useAuth();
  const { api, can } = usePermissions();
  const identity = useMemo(() => identityApi(api), [api]);
  const canWrite = can('users:write');
  const canAssign = can('roles:write');

  const [account, setAccount] = useState<UserAccount | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [role, setRole] = useState<string>('user');
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '' });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [loaded, assigned] = await Promise.all([identity.getUser(id), identity.getUserRole(id)]);
      setAccount(loaded);
      if (can('roles:read')) {
        try { setRoles((await identity.listRoles()).items); } catch { setMessage('Không thể tải danh sách vai trò.'); }
      }
      setRole(assigned.role.name);
      setForm({ email: loaded.email ?? '', firstName: loaded.firstName ?? '', lastName: loaded.lastName ?? '' });
    } catch (failure) {
      setLoadError(errorMessage(failure));
    }
  }, [identity, id, can]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Chạy một thao tác ghi: khóa nút, báo kết quả, tải lại dữ liệu. */
  async function act(success: string, action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    void act('Đã lưu thông tin.', () =>
      identity.updateUser(id, {
        email: form.email.trim(),
        ...(form.firstName.trim() && { firstName: form.firstName.trim() }),
        ...(form.lastName.trim() && { lastName: form.lastName.trim() }),
      }),
    );
  }

  if (loadError)
    return (
      <section className="card">
        <p role="alert">{loadError}</p>
        <Link className="btn" to="/users">
          Về danh sách
        </Link>
      </section>
    );
  if (!account) return <p role="status">Đang tải…</p>;

  const isSelf = me?.id === account.userId;

  return (
    <section className="card">
      <div className="row">
        <h1>{account.username}</h1>
        <Link className="btn" to="/users">
          Về danh sách
        </Link>
      </div>
      <p className="hint">
        {account.enabled ? 'Đang hoạt động' : 'Đã bị khóa'} · email {account.emailVerified ? 'đã' : 'chưa'} xác minh
      </p>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}

      <form className="form" onSubmit={saveProfile}>
        <h2>Thông tin</h2>
        <label>
          Email
          <input required type="email" maxLength={255} disabled={!canWrite} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Họ
          <input maxLength={255} disabled={!canWrite} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>
        <label>
          Tên
          <input maxLength={255} disabled={!canWrite} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>
        {canWrite && (
          <div className="row">
            <button type="submit" className="btn primary" disabled={busy}>
              Lưu
            </button>
          </div>
        )}
      </form>

      <div className="form">
        <h2>Role</h2>
        <label>
          Role hiện tại
          <select
            value={role}
            disabled={!canAssign || busy || isSelf || roles.length === 0}
            onChange={(event) => void act('Đã đổi role.', () => identity.assignRole(id, event.target.value))}
          >
            {Array.from(new Set([role, ...roles.map(item => item.name)])).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {canAssign && !isSelf && roles.length === 0 && <p className="hint">Cần tải danh sách vai trò để thay đổi vai trò.</p>}
        {isSelf && <p className="hint">Bạn không thể tự đổi role của chính mình.</p>}
      </div>

      {canWrite && (
        <div className="form">
          <h2>Tài khoản</h2>
          <div className="row">
            <button
              type="button"
              className="btn"
              disabled={busy || isSelf}
              onClick={() => void act(account.enabled ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.', () => identity.setEnabled(id, !account.enabled))}
            >
              {account.enabled ? 'Khóa tài khoản' : 'Mở khóa'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => void act('Đã gửi email đặt lại mật khẩu.', () => identity.sendPasswordReset(id))}
            >
              Gửi email đặt lại mật khẩu
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
