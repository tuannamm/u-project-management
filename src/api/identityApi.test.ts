import { ApiError, type ApiClient } from './apiClient';
import { errorMessage, identityApi } from './identityApi';

const fakeApi = () =>
  ({
    get: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue(null),
    delete: jest.fn(),
  }) as unknown as jest.Mocked<ApiClient>;

describe('identityApi', () => {
  it('lists users with pagination and search', async () => {
    const api = fakeApi();
    await identityApi(api).listUsers({ offset: 10, limit: 10, search: 'an' });
    expect(api.get).toHaveBeenCalledWith('/users?offset=10&limit=10&search=an');
  });

  it('assigns a role with PUT and encodes the id', async () => {
    const api = fakeApi();
    await identityApi(api).assignRole('a/b', 'admin');
    expect(api.put).toHaveBeenCalledWith('/users/a%2Fb/role', { roleName: 'admin' });
  });

  it('toggles the enabled status', async () => {
    const api = fakeApi();
    await identityApi(api).setEnabled('u1', false);
    expect(api.patch).toHaveBeenCalledWith('/users/u1/status', { enabled: false });
  });
});

describe('errorMessage', () => {
  it.each([
    [409, 'Tên đăng nhập hoặc email đã tồn tại.'],
    [403, 'Bạn không có quyền thực hiện thao tác này.'],
    [503, 'Lỗi tạm thời, vui lòng thử lại.'],
  ])('maps %i', (status, text) => {
    expect(errorMessage(new ApiError({ status }))).toBe(text);
  });
});
