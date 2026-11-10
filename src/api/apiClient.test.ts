import { ApiError, createApiClient, type ApiClientOptions } from './apiClient';

type FakeResponse = Pick<Response, 'status' | 'ok' | 'json'> & { headers: { get: (name: string) => string | null } };

const json = (status: number, body?: unknown, headers: Record<string, string> = {}): FakeResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

function setup(responses: Array<FakeResponse | Error>, overrides: Partial<Omit<ApiClientOptions, 'baseUrl' | 'fetchImpl'>> = {}) {
  const fetchImpl = jest.fn();
  responses.forEach((response) =>
    response instanceof Error ? fetchImpl.mockRejectedValueOnce(response) : fetchImpl.mockResolvedValueOnce(response),
  );
  const handlers = {
    getToken: jest.fn().mockResolvedValue('token-1'),
    forceRefresh: jest.fn().mockResolvedValue(true),
    onUnauthorized: jest.fn(),
    onForbidden: jest.fn(),
    ...overrides,
  };
  const client = createApiClient({ baseUrl: 'http://gw', fetchImpl: fetchImpl as unknown as typeof fetch, ...handlers });
  return { client, fetchImpl, ...handlers };
}

describe('apiClient', () => {
  it('sends the bearer token and a request id', async () => {
    const { client, fetchImpl } = setup([json(200, { ok: true })]);
    await expect(client.get('/me/permissions')).resolves.toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://gw/me/permissions');
    expect(init.headers.authorization).toBe('Bearer token-1');
    expect(init.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('sends a JSON body with content-type', async () => {
    const { client, fetchImpl } = setup([json(200, {})]);
    await client.patch('/me', { locale: 'vi' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.body).toBe('{"locale":"vi"}');
  });

  it('returns null for 204', async () => {
    const { client } = setup([json(204)]);
    await expect(client.delete('/x')).resolves.toBeNull();
  });

  it('refreshes the token and retries exactly once after a 401', async () => {
    const { client, fetchImpl, forceRefresh, onUnauthorized } = setup([json(401, {}), json(200, { ok: 1 })]);
    await expect(client.get('/x')).resolves.toEqual({ ok: 1 });
    expect(forceRefresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports an expired session when the retry is still 401', async () => {
    const { client, fetchImpl, onUnauthorized } = setup([json(401, {}), json(401, { code: 'UNAUTHORIZED' })]);
    await expect(client.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the refresh fails', async () => {
    const { client, fetchImpl, onUnauthorized } = setup([json(401, {})], { forceRefresh: jest.fn().mockResolvedValue(false) });
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not log out on 403, but asks to reload permissions', async () => {
    const { client, onForbidden, onUnauthorized, forceRefresh } = setup([json(403, { code: 'FORBIDDEN', detail: 'no', requestId: 'r1' })]);
    await expect(client.get('/users')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', requestId: 'r1', retryable: false });
    expect(onForbidden).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(forceRefresh).not.toHaveBeenCalled();
  });

  it('marks 503 AUTHZ_UNAVAILABLE as a retryable error, not a denial', async () => {
    const { client, onForbidden } = setup([json(503, { code: 'AUTHZ_UNAVAILABLE' }, { 'x-request-id': 'r2' })]);
    await expect(client.get('/users')).rejects.toMatchObject({ status: 503, code: 'AUTHZ_UNAVAILABLE', retryable: true, requestId: 'r2' });
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('turns a network failure into a retryable ApiError', async () => {
    const { client } = setup([new TypeError('Failed to fetch')]);
    await expect(client.get('/x')).rejects.toMatchObject({ status: 0, retryable: true });
  });

  it('propagates a failure to obtain a token without calling the API', async () => {
    const { client, fetchImpl } = setup([], { getToken: jest.fn().mockRejectedValue(new Error('expired')) });
    await expect(client.get('/x')).rejects.toThrow('expired');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
