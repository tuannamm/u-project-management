import { useState } from 'react';
import { ApiError } from '../api/apiClient';
import { Can, usePermissions } from '../permissions/PermissionsProvider';

type CallResult =
  | { state: 'loading' }
  | { state: 'ok'; data: unknown }
  | { state: 'error'; error: unknown };

function describe(error: unknown): { message: string; code?: string; requestId?: string } {
  if (error instanceof ApiError) {
    const message = error.retryable
      ? 'Lỗi tạm thời, vui lòng thử lại.'
      : error.status === 403
        ? 'Bạn không có quyền thực hiện thao tác này.'
        : 'Có lỗi xảy ra.';
    return { message, code: error.code, requestId: error.requestId };
  }
  return { message: 'Có lỗi xảy ra.' };
}

/**
 * Trang minh họa luồng: hiển thị role/permission của mình (từ /me/permissions) và thử một lời gọi
 * bị chặn ở gateway/service để thấy 403 hoạt động ra sao.
 */
export function DashboardPage() {
  const { status, role, permissions, api, refresh } = usePermissions();
  const [result, setResult] = useState<CallResult | null>(null);

  async function tryListUsers() {
    setResult({ state: 'loading' });
    try {
      setResult({ state: 'ok', data: await api.get('/users') });
    } catch (error) {
      setResult({ state: 'error', error });
    }
  }

  const failure = result?.state === 'error' ? describe(result.error) : null;

  return (
    <section className="card">
      <h1>Quyền của bạn</h1>
      {(status === 'idle' || status === 'loading') && <p role="status">Đang tải quyền…</p>}
      {status === 'error' && (
        <p role="alert">
          Không tải được quyền.{' '}
          <button type="button" className="btn" onClick={refresh}>
            Thử lại
          </button>
        </p>
      )}
      {status === 'ready' && (
        <>
          <p>
            Role: <strong>{role?.name ?? 'không có'}</strong>
          </p>
          {permissions.size === 0 ? (
            <p>Chưa có permission nào.</p>
          ) : (
            <ul className="chips" aria-label="Danh sách permission">
              {[...permissions].sort().map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          )}
          <p className="hint">Menu và nút chỉ ẩn/hiện theo quyền để dễ dùng. Việc chặn thật xảy ra ở gateway và service.</p>
          <Can
            permission="users:read"
            fallback={
              <p className="hint">
                Bạn không có <code>users:read</code> nên nút thử gọi API bị ẩn.
              </p>
            }
          >
            <button type="button" className="btn" onClick={() => void tryListUsers()}>
              Thử gọi GET /users
            </button>
          </Can>
          {result?.state === 'loading' && <p role="status">Đang gọi…</p>}
          {result?.state === 'ok' && <pre>{JSON.stringify(result.data, null, 2)}</pre>}
          {failure && (
            <p role="alert">
              {failure.message} {failure.code && <code>{failure.code}</code>}{' '}
              {failure.requestId && <small>Mã yêu cầu: {failure.requestId}</small>}
            </p>
          )}
        </>
      )}
    </section>
  );
}
