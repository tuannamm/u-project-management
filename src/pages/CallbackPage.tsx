import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { takeReturnTo } from '../auth/returnTo';

/** Keycloak chuyển người dùng về đây kèm mã; keycloak-js đã đổi mã lấy token trong AuthProvider. */
export function CallbackPage() {
  const { status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'authenticated') navigate(takeReturnTo(), { replace: true });
  }, [status, navigate]);

  if (status === 'error') return <p role="alert">Không hoàn tất được đăng nhập. Vui lòng tải lại trang.</p>;
  return <p role="status">Đang đăng nhập…</p>;
}
