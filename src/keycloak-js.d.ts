// keycloak-js publica kiểu chỉ qua trường `exports`, mà Create React App ép `moduleResolution: node`
// (TypeScript bỏ qua `exports`). Khai báo này trỏ về file .d.ts của gói; lúc chạy webpack vẫn resolve theo `exports`.
declare module 'keycloak-js' {
  import Keycloak from 'keycloak-js/lib/keycloak';
  export * from 'keycloak-js/lib/keycloak';
  export default Keycloak;
}
