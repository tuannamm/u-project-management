// Cấu hình đọc từ biến môi trường lúc build (CRA chỉ nhúng biến bắt đầu bằng REACT_APP_).
// Không có secret nào ở đây: pm-web là public client dùng PKCE.
export interface AppConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
  apiUrl: string;
}

export const config: AppConfig = {
  keycloakUrl: process.env.REACT_APP_KEYCLOAK_URL || 'http://localhost:8081',
  realm: process.env.REACT_APP_KEYCLOAK_REALM || 'pm',
  clientId: process.env.REACT_APP_KEYCLOAK_CLIENT_ID || 'pm-web',
  apiUrl: (process.env.REACT_APP_API_URL || 'http://localhost:3000').replace(/\/+$/, ''),
};
