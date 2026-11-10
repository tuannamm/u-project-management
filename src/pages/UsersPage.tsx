import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage, identityApi, type UserAccount } from '../api/identityApi';
import { DataTable } from '../components/kit/DataTable';
import { Can, usePermissions } from '../permissions/PermissionsProvider';

const PAGE_SIZE = 10;

type RoleMap = Record<string, string | undefined>;

/** Danh sách user (users:read): tìm kiếm, phân trang, role của từng dòng. */
export function UsersPage() {
  const { api } = usePermissions();
  const identity = useMemo(() => identityApi(api), [api]);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [roles, setRoles] = useState<RoleMap>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setUsers(null);
    try {
      const page = await identity.listUsers({ offset, limit: PAGE_SIZE, search: search || undefined });
      setUsers(page.items);
      // Danh sách của Keycloak không kèm role nên tra từng dòng; lỗi một dòng không làm hỏng cả trang.
      const found = await Promise.allSettled(page.items.map((user) => identity.getUserRole(user.userId)));
      setRoles(
        Object.fromEntries(
          page.items.map((user, index) => {
            const result = found[index];
            return [user.userId, result.status === 'fulfilled' ? result.value.role.name : undefined];
          }),
        ),
      );
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }, [identity, offset, search]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setOffset(0);
    setSearch(draft.trim());
  }

  return (
    <section className="card">
      <div className="row">
        <div><p className="eyebrow">QUẢN TRỊ TRUY CẬP</p><h1>Người dùng</h1><p className="hint">Quản lý tài khoản và vai trò của người dùng.</p></div>
        <Can permission="users:write">
          <Link className="btn primary" to="/users/new">
            Tạo người dùng
          </Link>
        </Can>
      </div>
      <form className="row" onSubmit={submitSearch} role="search">
        <input
          aria-label="Tìm người dùng"
          placeholder="Tên đăng nhập, email…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className="btn">
          Tìm
        </button>
      </form>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" className="btn" onClick={() => void load()}>
            Thử lại
          </button>
        </p>
      )}
      {!error && users === null && <p role="status">Đang tải…</p>}
      {users && <DataTable caption="Danh sách người dùng" rows={users} rowKey={user => user.userId} empty="Không có người dùng nào." columns={[
        { key: 'username', header: 'Tên đăng nhập', render: user => <Link to={`/users/${encodeURIComponent(user.userId)}`}>{user.username}</Link> },
        { key: 'email', header: 'Email', render: user => user.email || '—' },
        { key: 'role', header: 'Vai trò', render: user => roles[user.userId] ?? '—' },
        { key: 'status', header: 'Trạng thái', render: user => <span className={user.enabled ? 'status active' : 'status'}>{user.enabled ? 'Hoạt động' : 'Đã khóa'}</span> },
      ]} />}
      <div className="row">
        <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
          Trước
        </button>
        <span className="hint">Trang {offset / PAGE_SIZE + 1}</span>
        <button
          type="button"
          className="btn"
          disabled={!users || users.length < PAGE_SIZE}
          onClick={() => setOffset(offset + PAGE_SIZE)}
        >
          Sau
        </button>
      </div>
    </section>
  );
}
