// Nhớ trang người dùng đang xem trước khi chuyển sang Keycloak để quay lại sau khi đăng nhập.
// Giá trị này đi qua sessionStorage (do mã của mình ghi), nhưng vẫn kiểm tra như dữ liệu không tin cậy
// để không thể biến thành open redirect.
const KEY = 'pm.return-to';
const DEFAULT_PATH = '/app';

/** Chỉ nhận đường dẫn nội bộ (bắt đầu bằng một "/"); mọi thứ khác về trang mặc định. */
export function safeReturnTo(path: unknown): string {
  if (typeof path !== 'string' || path.length > 2048) return DEFAULT_PATH;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return DEFAULT_PATH;
  if ([...path].some((char) => char.charCodeAt(0) < 0x20)) return DEFAULT_PATH; // ký tự điều khiển (CR/LF...)
  if (path === '/callback' || path.startsWith('/callback?') || path.startsWith('/callback#')) return DEFAULT_PATH;
  return path;
}

export function saveReturnTo(path: unknown): void {
  try {
    sessionStorage.setItem(KEY, safeReturnTo(path));
  } catch {
    // Trình duyệt chặn storage: bỏ qua, sẽ về trang mặc định.
  }
}

/** Đọc rồi xóa ngay: mỗi lần đăng nhập chỉ dùng một lần. */
export function takeReturnTo(): string {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safeReturnTo(value);
  } catch {
    return DEFAULT_PATH;
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // bỏ qua
  }
}
