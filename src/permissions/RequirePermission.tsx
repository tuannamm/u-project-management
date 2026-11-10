import type { ReactNode } from 'react';
import { ForbiddenPage } from '../pages/ForbiddenPage';
import { usePermissions } from './PermissionsProvider';

/** Route cần permission: chờ tải quyền xong rồi mới quyết định; thiếu quyền thì hiện trang 403. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { status, can } = usePermissions();
  if (status === 'idle' || status === 'loading') return <p role="status">Đang tải quyền…</p>;
  if (status === 'error') return <p role="alert">Không tải được quyền. Vui lòng thử lại.</p>;
  return can(permission) ? <>{children}</> : <ForbiddenPage />;
}
