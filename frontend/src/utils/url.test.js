import { safeHttpUrl } from './url';

describe('safeHttpUrl', () => {
  test('절대 http/https URL은 정규화된 href를 반환', () => {
    expect(safeHttpUrl('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
  });

  test('javascript: 등 비허용 스킴은 null', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('data:text/html,<script>')).toBeNull();
    expect(safeHttpUrl('mailto:a@b.com')).toBeNull();
  });

  test('프로토콜-상대(//host)·상대경로는 null (자기 origin 절대화 차단)', () => {
    expect(safeHttpUrl('//evil.com')).toBeNull();
    expect(safeHttpUrl('/internal/path')).toBeNull();
    expect(safeHttpUrl('foo')).toBeNull();
  });

  test('빈값/비문자열은 null', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl(123)).toBeNull();
  });
});
