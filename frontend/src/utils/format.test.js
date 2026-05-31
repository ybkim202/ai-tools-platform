import {
  formatPrice,
  formatScore,
  formatDate,
  displayLabel,
  FALLBACK_DASH,
} from './format';

describe('formatPrice', () => {
  test('0은 무료', () => {
    expect(formatPrice(0)).toBe('무료');
  });
  test('양수는 $N, billingPeriod 옵션 시 $N/기간', () => {
    expect(formatPrice(20)).toBe('$20');
    expect(formatPrice(20, { billingPeriod: 'month' })).toBe('$20/month');
  });
  test('음수/비정상은 폴백', () => {
    expect(formatPrice(-1)).toBe(FALLBACK_DASH);
    expect(formatPrice('abc')).toBe(FALLBACK_DASH);
  });
});

describe('formatScore', () => {
  test('범위 내 유한값은 N/max', () => {
    expect(formatScore(85)).toBe('85/100');
    expect(formatScore(0)).toBe('0/100');
  });
  test('null/문자열/음수/범위초과는 폴백', () => {
    expect(formatScore(null)).toBe(FALLBACK_DASH);
    expect(formatScore('high')).toBe(FALLBACK_DASH);
    expect(formatScore(undefined)).toBe(FALLBACK_DASH);
    expect(formatScore(-5)).toBe(FALLBACK_DASH);
    expect(formatScore(150)).toBe(FALLBACK_DASH);
  });
});

describe('formatDate', () => {
  test('유효 날짜는 YYYY.MM.DD', () => {
    expect(formatDate('2026-01-05')).toBe('2026.01.05');
  });
  test('파싱 실패/누락은 null', () => {
    expect(formatDate('어제')).toBeNull();
    expect(formatDate('')).toBeNull();
    expect(formatDate(null)).toBeNull();
  });
});

describe('displayLabel', () => {
  test('빈/공백 문자열은 폴백', () => {
    expect(displayLabel('')).toBe(FALLBACK_DASH);
    expect(displayLabel('   ')).toBe(FALLBACK_DASH);
    expect(displayLabel(null)).toBe(FALLBACK_DASH);
    expect(displayLabel(undefined)).toBe(FALLBACK_DASH);
  });
  test('값이 있으면 트림하여 반환', () => {
    expect(displayLabel(' Pro ')).toBe('Pro');
  });
});
