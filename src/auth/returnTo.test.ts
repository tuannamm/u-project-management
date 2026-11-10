import { clearReturnTo, safeReturnTo, saveReturnTo, takeReturnTo } from './returnTo';

describe('returnTo', () => {
  beforeEach(() => sessionStorage.clear());

  it.each(['/app', '/app/projects/1?tab=a', '/app#section'])('keeps the internal path %p', (path) => {
    expect(safeReturnTo(path)).toBe(path);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'app',
    '',
    null,
    undefined,
    42,
    '/callback',
    '/callback?x=1',
    '/a\nb',
    `/${'a'.repeat(3000)}`,
  ])('falls back to /app for the unsafe value %p (no open redirect)', (value) => {
    expect(safeReturnTo(value)).toBe('/app');
  });

  it('is read once and then forgotten', () => {
    saveReturnTo('/app/projects');
    expect(takeReturnTo()).toBe('/app/projects');
    expect(takeReturnTo()).toBe('/app');
  });

  it('sanitises a tampered stored value', () => {
    sessionStorage.setItem('pm.return-to', 'https://evil.example');
    expect(takeReturnTo()).toBe('/app');
  });

  it('can be cleared', () => {
    saveReturnTo('/app/x');
    clearReturnTo();
    expect(takeReturnTo()).toBe('/app');
  });
});
