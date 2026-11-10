# u-project-management

UI React + TypeScript (Create React App) cho hệ thống Project Management.

## Chạy local

1. Chạy Keycloak, import `apps/w-identity/fixtures/pm-realm.json` (xem README của w-identity) và tạo một tài khoản thử trong realm `pm`.
2. Chạy API Gateway với `GATEWAY_CORS_ORIGINS=http://localhost:3001` (xem `apps/api-gateway/.env.identity.example`).
3. Từ thư mục này: `npm start` → http://localhost:3001 (cấu hình ở `.env.development`).

## Đăng nhập và đăng xuất

- Authorization Code + PKCE (`keycloak-js`), client `pm-web`. SPA **không** nhận mật khẩu: trang đăng nhập do Keycloak phục vụ.
- Ứng dụng **bắt buộc đăng nhập**: chưa có phiên thì chuyển thẳng sang trang đăng nhập của Keycloak (`onLoad: 'login-required'`), không cần bấm nút. Đăng xuất xong quay về `/` và lại sang trang đăng nhập.
- Token chỉ nằm trong bộ nhớ; F5 hỏi lại Keycloak, phiên SSO còn thì không phải nhập lại mật khẩu.
- Đăng xuất xóa token ở UI và chuyển hướng tới `/logout` của Keycloak để hủy phiên SSO. Access token đã cấp vẫn hợp lệ đến khi hết hạn.
- `apiClient` gắn `Authorization: Bearer`; 401 → làm mới và thử lại một lần, vẫn lỗi thì sang trang đăng nhập; 403 → tải lại `/me/permissions`; 503 → báo lỗi tạm thời.
- Permission chỉ dùng để ẩn/hiện giao diện. Việc chặn thật ở gateway và service.

Kế hoạch và quyết định: `apps/w-identity/documents/PLAN-AUTH-UI.md`; học và ôn: sổ tay `#authz` trong Knowledge Base.

## Lệnh

- `npm run typecheck` — kiểm tra kiểu (`tsc --noEmit`).
- `npm test` — chạy test (auth giả, không cần Keycloak).
- `npm run build` — build production.

Ghi chú về công cụ:
- React Router dùng v6 vì Jest của Create React App 5 không nạp được v7.
- TypeScript ghim `4.9.5` (react-scripts 5 chỉ hỗ trợ đến 4.x) và `@types/node@20`, `@types/jest@29` để tương thích với bản này.
- `src/keycloak-js.d.ts` trỏ kiểu của `keycloak-js` vì gói chỉ khai báo kiểu qua `exports`, còn Create React App ép `moduleResolution: node`.
