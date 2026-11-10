import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { errorMessage, identityApi, type Permission, type RoleSummary } from '../api/identityApi';
import { usePermissions } from '../permissions/PermissionsProvider';
import { Button } from '../components/kit/Button';
import { DataTable } from '../components/kit/DataTable';

export function AccessManagementPage({ mode }: { mode: 'roles' | 'permissions' }) {
  const { api, can } = usePermissions();
  const identity = useMemo(() => identityApi(api), [api]);
  const [roles, setRoles] = useState<RoleSummary[] | null>(null);
  const [permissions, setPermissions] = useState<Permission[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isRoles = mode === 'roles';
  const canWrite = can(isRoles ? 'roles:write' : 'permissions:write');
  const canReadPermissions = can('permissions:read');
  const load = useCallback(async () => {
    setError(null);
    try {
      if (isRoles) {
        const result = await identity.listRoles();
        setRoles(result.items);
        if (canReadPermissions) setPermissions((await identity.listPermissions()).items);
      } else setPermissions((await identity.listPermissions()).items);
    } catch (e) { setError(errorMessage(e)); }
  }, [identity, isRoles, canReadPermissions]);
  useEffect(() => { setRoles(null); setPermissions(null); setSelected(''); void load(); }, [load]);
  const activeRole = roles?.find(role => role.name === selected);
  async function act(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); await load(); } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    const value = name.trim(); const detail = description.trim();
    if (!value) return;
    void act(async () => {
      if (isRoles) await identity.createRole({ name: value, ...(detail && { description: detail }) });
      else await identity.createPermission({ key: value, ...(detail && { description: detail }) });
      setName(''); setDescription('');
    });
  }
  return <section className="card management">
    <div className="page-heading"><div><p className="eyebrow">QUẢN TRỊ TRUY CẬP</p><h1>{isRoles ? 'Vai trò' : 'Quyền hạn'}</h1><p className="hint">{isRoles ? 'Quản lý vai trò và các quyền được cấp.' : 'Quản lý danh mục quyền trong hệ thống.'}</p></div></div>
    {error && <div className="notice" role="alert">{error} <Button variant="ghost" onClick={() => void load()}>Thử lại</Button></div>}
    {canWrite && <form className="create-access" onSubmit={create}>
      <h2>{isRoles ? 'Tạo vai trò' : 'Tạo quyền'}</h2>
      <div className="access-fields"><label>{isRoles ? 'Tên vai trò' : 'Mã quyền'}<input required pattern={isRoles ? "[a-z][a-z0-9_-]{1,49}" : "[a-z][a-z0-9-]*:[a-z][a-z0-9-]*"} title={isRoles ? "2–50 ký tự, bắt đầu bằng chữ thường; dùng chữ thường, số, _ hoặc -" : "Dùng định dạng resource:action bằng chữ thường"} maxLength={isRoles ? 50 : 100} value={name} onChange={e => setName(e.target.value)} placeholder={isRoles ? 'vd. editor' : 'vd. projects:read'} /></label>
      <label>Mô tả<input maxLength={255} value={description} onChange={e => setDescription(e.target.value)} placeholder="Mô tả ngắn" /></label>
      <Button type="submit" disabled={busy}>{isRoles ? 'Tạo vai trò' : 'Tạo quyền'}</Button></div>
    </form>}
    <h2>Danh sách {isRoles ? 'vai trò' : 'quyền'}</h2>
    {isRoles ? roles === null ? <p role="status">Đang tải…</p> : <DataTable caption="Danh sách vai trò" rows={roles} rowKey={r => r.name} empty="Chưa có vai trò" columns={[
      { key: 'name', header: 'Vai trò', render: r => <strong>{r.name}</strong> },
      { key: 'description', header: 'Mô tả', render: r => r.description || '—' },
      { key: 'count', header: 'Quyền', render: r => r.permissionKeys.length },
      { key: 'actions', header: 'Thao tác', render: r => <div className="actions"><Button variant="secondary" size="sm" onClick={() => { setSelected(r.name); setEditDescription(r.description || ''); }}>Chi tiết</Button>{canWrite && !r.system && <Button variant="danger" size="sm" disabled={busy} onClick={() => { if (window.confirm(`Xóa vai trò ${r.name}?`)) void act(() => identity.deleteRole(r.name)); }}>Xóa</Button>}</div> },
    ]} /> : permissions === null ? <p role="status">Đang tải…</p> : <DataTable caption="Danh sách quyền" rows={permissions} rowKey={p => p.key} empty="Chưa có quyền" columns={[
      { key: 'key', header: 'Mã quyền', render: p => <code>{p.key}</code> },
      { key: 'description', header: 'Mô tả', render: p => p.description || '—' },
      { key: 'actions', header: 'Thao tác', render: p => canWrite && <Button variant="danger" size="sm" disabled={busy} onClick={() => { if (window.confirm(`Xóa quyền ${p.key}?`)) void act(() => identity.deletePermission(p.key)); }}>Xóa</Button> },
    ]} />}
    {activeRole && <div className="role-detail"><div className="row"><div><h2>Quyền của {activeRole.name}</h2><p className="hint">{activeRole.system ? 'Vai trò hệ thống chỉ có thể xem.' : 'Chọn quyền để cấp hoặc thu hồi.'}</p></div><Button variant="ghost" onClick={() => setSelected('')}>Đóng</Button></div>
      {canWrite && !activeRole.system && <form className="access-fields role-description" onSubmit={e => { e.preventDefault(); const value = editDescription.trim(); if (value) void act(() => identity.updateRole(activeRole.name, value)); }}><label>Mô tả<input required maxLength={255} value={editDescription} onChange={e => setEditDescription(e.target.value)} /></label><Button type="submit" variant="secondary" disabled={busy}>Lưu mô tả</Button></form>}
      {!canReadPermissions ? <ul>{activeRole.permissionKeys.map(key => <li key={key}><code>{key}</code></li>)}</ul> : !permissions ? <p>Không thể tải danh sách quyền.</p> : permissions.length === 0 ? <p>Chưa có quyền để cấp.</p> : <div className="permission-list">{permissions.map(p => <label key={p.key}><input type="checkbox" checked={activeRole.permissionKeys.includes(p.key)} disabled={!canWrite || activeRole.system || busy} onChange={e => void act(() => e.target.checked ? identity.grantPermission(activeRole.name, p.key) : identity.revokePermission(activeRole.name, p.key))} /><span><code>{p.key}</code>{p.description && <small>{p.description}</small>}</span></label>)}</div>}
    </div>}
  </section>;
}
