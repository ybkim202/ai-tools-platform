import {
  formatPrice,
  formatScore,
  formatDate,
  displayLabel,
  FALLBACK_DASH,
  PRICE_UNKNOWN,
} from './format';

describe('formatPrice', () => {
  test('0은 무료', () => {
    expect(formatPrice(0)).toBe('무료');
  });
  test('양수는 $N, billingPeriod 코드값은 한글 접미사', () => {
    expect(formatPrice(20)).toBe('$20');
    expect(formatPrice(20, { billingPeriod: 'monthly' })).toBe('$20/월');
    expect(formatPrice(120, { billingPeriod: 'annual' })).toBe('$120/년');
    expect(formatPrice(50, { billingPeriod: 'onetime' })).toBe('$50/1회');
  });
  test('free 또는 미지의 billingPeriod는 접미사 없음', () => {
    expect(formatPrice(20, { billingPeriod: 'free' })).toBe('$20');
    expect(formatPrice(20, { billingPeriod: 'weird' })).toBe('$20');
  });
  test('null/undefined/빈문자열은 미상(0=무료와 구분)', () => {
    expect(formatPrice(null)).toBe(PRICE_UNKNOWN);
    expect(formatPrice(undefined)).toBe(PRICE_UNKNOWN);
    expect(formatPrice('')).toBe(PRICE_UNKNOWN);
    expect(formatPrice('   ')).toBe(PRICE_UNKNOWN);
  });
  test('음수/비정상은 미상', () => {
    expect(formatPrice(-1)).toBe(PRICE_UNKNOWN);
    expect(formatPrice('abc')).toBe(PRICE_UNKNOWN);
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
