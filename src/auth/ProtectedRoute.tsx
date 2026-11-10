import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

/**
 * Giữ nội dung cho đến khi đã đăng nhập. Chưa có phiên thì AuthProvider đã chuyển sang trang đăng nhập,
 * nên ở đây chỉ còn: chờ (loading), báo lỗi kết nối Keycloak, hoặc hiện nội dung.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') return <p role="status">Đang chuyển tới trang đăng nhập…</p>;
  if (status === 'error') {
    return (
      <section className="card">
        <h1>Không kết nối được máy chủ đăng nhập</h1>
        <p>Vui lòng kiểm tra Keycloak đang chạy rồi thử lại.</p>
        <button type="button" className="btn primary" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </section>
    );
  }
  return <>{children}</>;
}
