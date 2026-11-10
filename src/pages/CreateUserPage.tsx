import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage, identityApi, type RoleSummary } from '../api/identityApi';
import { usePermissions } from '../permissions/PermissionsProvider';

/** Tạo user mới (users:write) rồi gán role (roles:write). Người dùng đặt mật khẩu ở lần đăng nhập đầu. */
export function CreateUserPage() {
  const { api, can } = usePermissions();
  const identity = useMemo(() => identityApi(api), [api]);
  const navigate = useNavigate();
  const canAssign = can('roles:write');
  const [form, setForm] = useState({ username: '', email: '', firstName: '', lastName: '' });
  const [role, setRole] = useState('user');
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  useEffect(() => { if (can('roles:read')) void identity.listRoles().then(result => setRoles(result.items)).catch(() => setError('Không thể tải danh sách vai trò.')); }, [identity, can]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    let userId: string | undefined;
    try {
      const created = await identity.createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        ...(form.firstName.trim() && { firstName: form.firstName.trim() }),
        ...(form.lastName.trim() && { lastName: form.lastName.trim() }),
      });
      userId = created.userId;
      // Role mặc định là `user` (không cần ghi); chỉ gọi API khi chọn role khác.
      if (canAssign && role !== 'user') await identity.assignRole(userId, role);
      navigate(`/users/${encodeURIComponent(userId)}`, { replace: true });
    } catch (failure) {
      if (userId) {
        // User đã tạo, chỉ bước gán role lỗi: đưa sang trang chi tiết để thử lại, không tạo trùng.
        navigate(`/users/${encodeURIComponent(userId)}`, { replace: true, state: { notice: 'Đã tạo người dùng nhưng chưa gán được role. Hãy thử lại.' } });
        return;
      }
      setError(errorMessage(failure));
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h1>Tạo người dùng</h1>
      <form className="form" onSubmit={submit}>
        <label>
          Tên đăng nhập
          <input required maxLength={255} value={form.username} onChange={set('username')} />
        </label>
        <label>
          Email
          <input required type="email" maxLength={255} value={form.email} onChange={set('email')} />
        </label>
        <label>
          Họ
          <input maxLength={255} value={form.lastName} onChange={set('lastName')} />
        </label>
        <label>
          Tên
          <input maxLength={255} value={form.firstName} onChange={set('firstName')} />
        </label>
        <label>
          Role
          <select value={role} disabled={!canAssign || roles.length === 0} onChange={(event) => setRole(event.target.value)}>
            {(roles.length ? roles.map(item => item.name) : ['user']).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">Người dùng sẽ được yêu cầu đặt mật khẩu ở lần đăng nhập đầu tiên.</p>
        {error && <p role="alert">{error}</p>}
        <div className="row">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Đang tạo…' : 'Tạo'}
          </button>
          <Link className="btn" to="/users">
            Hủy
          </Link>
        </div>
      </form>
    </section>
  );
}
