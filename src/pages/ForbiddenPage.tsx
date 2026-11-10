import { Link } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <section className="card">
      <h1>Không có quyền truy cập</h1>
      <p>Tài khoản của bạn chưa được cấp quyền cho nội dung này.</p>
      <Link className="btn" to="/app">
        Về trang chính
      </Link>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="card">
      <h1>Không tìm thấy trang</h1>
      <Link className="btn" to="/">
        Về trang chủ
      </Link>
    </section>
  );
}
