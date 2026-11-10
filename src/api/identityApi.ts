import type { ApiClient } from './apiClient';
import { ApiError } from './apiClient';

/** Hai role hệ thống hiện có. Danh sách thật vẫn lấy từ GET /roles; hằng này chỉ để sắp xếp/nhãn. */
export const ROLE_NAMES = ['user', 'admin'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export interface UserAccount {
  userId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
}

export interface UserPage {
  items: UserAccount[];
  offset: number;
  limit: number;
}

export interface CreateUserInput {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export type UpdateUserInput = Partial<Pick<CreateUserInput, 'email' | 'firstName' | 'lastName'>>;

export interface RoleSummary {
  name: string;
  description?: string;
  permissionKeys: string[];
  system: boolean;
}

export interface Permission {
  key: string;
  description?: string;
}

export interface UserRoleResponse {
  userId: string;
  role: RoleSummary;
}

export interface ListUsersParams {
  offset: number;
  limit: number;
  search?: string;
}

const enc = encodeURIComponent;

/** Bọc các endpoint quản lý user/role của gateway (xem specs/identity/openapi.yml). */
export function identityApi(api: ApiClient) {
  return {
    listUsers({ offset, limit, search }: ListUsersParams) {
      const query = new URLSearchParams({ offset: String(offset), limit: String(limit) });
      if (search) query.set('search', search);
      return api.get<UserPage>(`/users?${query}`);
    },
    getUser: (id: string) => api.get<UserAccount>(`/users/${enc(id)}`),
    createUser: (input: CreateUserInput) => api.post<UserAccount>('/users', input),
    updateUser: (id: string, patch: UpdateUserInput) => api.patch<UserAccount>(`/users/${enc(id)}`, patch),
    setEnabled: (id: string, enabled: boolean) => api.patch<UserAccount>(`/users/${enc(id)}/status`, { enabled }),
    sendPasswordReset: (id: string) => api.post<null>(`/users/${enc(id)}/password-reset-email`),
    getUserRole: (id: string) => api.get<UserRoleResponse>(`/users/${enc(id)}/role`),
    assignRole: (id: string, roleName: string) => api.put<null>(`/users/${enc(id)}/role`, { roleName }),
    listRoles: () => api.get<{ items: RoleSummary[] }>('/roles'),
    createRole: (input: { name: string; description?: string }) => api.post<RoleSummary>('/roles', input),
    updateRole: (name: string, description: string) => api.patch<RoleSummary>(`/roles/${enc(name)}`, { description }),
    deleteRole: (name: string) => api.delete(`/roles/${enc(name)}`),
    grantPermission: (name: string, permissionKey: string) => api.post(`/roles/${enc(name)}/permissions`, { permissionKey }),
    revokePermission: (name: string, key: string) => api.delete(`/roles/${enc(name)}/permissions/${enc(key)}`),
    listPermissions: () => api.get<{ items: Permission[] }>('/permissions'),
    createPermission: (input: { key: string; description?: string }) => api.post<Permission>('/permissions', input),
    deletePermission: (key: string) => api.delete(`/permissions/${enc(key)}`),
  };
}

/** Thông báo tiếng Việt cho lỗi API; không lộ chi tiết nội bộ. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Có lỗi xảy ra.';
  if (error.retryable) return 'Lỗi tạm thời, vui lòng thử lại.';
  switch (error.status) {
    case 400:
      return 'Dữ liệu không hợp lệ.';
    case 403:
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 404:
      return 'Không tìm thấy dữ liệu.';
    case 409:
      return 'Dữ liệu đã tồn tại hoặc đang được sử dụng.';
    default:
      return 'Có lỗi xảy ra.';
  }
}
