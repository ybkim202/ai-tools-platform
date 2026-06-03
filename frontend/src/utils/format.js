// 표시용 포매터 모음. 데이터가 누락/소수일 때도 안전하게 처리한다.

// 빈값/비정상 표기 공통 상수(가격·날짜·사용자 수 등 메타 위계). 색은 호출부에서 tertiary 권장.
export const FALLBACK_DASH = '-';

// 빈값/미상 표기 상수. price가 null/undefined/빈문자열/비유한값일 때 사용한다.
// (0='무료'과 명확히 구분 — Number(null)===0 오표시 방지.)
export const PRICE_UNKNOWN = '미상';

// billing_period 코드값 → 보기 좋은 한글 접미사 매핑.
// DB가 보장하는 4값(monthly/annual/onetime/free)을 정본으로 매핑한다(backend schema.sql).
// 'free'·가격0은 '무료'로 흡수되므로 접미사 불필요(빈 문자열 반환).
// 미지정/미지의 코드는 접미사 없이 금액만 표기(과설계 방지).
const BILLING_PERIOD_SUFFIX = {
  monthly: '/월',
  annual: '/년',
  onetime: '/1회',
  free: '',
};

const billingPeriodSuffix = (billingPeriod) => {
  if (typeof billingPeriod !== 'string' || billingPeriod === '') return '';
  return BILLING_PERIOD_SUFFIX[billingPeriod] ?? '';
};

// 가격 표시: formatUserCount의 방어 패턴(Number 변환 + Number.isFinite + 폴백)을 따른다.
// - price === 0            → '무료'
// - 양수 유한값            → `$N` (옵션 billingPeriod 코드값을 한글 접미사로 붙임: 예 `$20/월`)
// - null/undefined/빈문자열/NaN/음수 → PRICE_UNKNOWN('미상')  (0='무료'과 구분)
// Compare·Details 양쪽 모두 동일 옵션(billingPeriod)으로 호출해 페이지 간 표기를 통일한다.
// (통화 변환·원화 병기는 D3 영역 → 미포함. currency는 USD 단일 가정($ 접두) — 과설계 금지.)
export const formatPrice = (price, options = {}) => {
  // null/''/공백 등은 Number()가 0으로 강제 변환되므로 사전 차단(0='무료'과 누락='미상' 구분).
  if (price === null || price === undefined) return PRICE_UNKNOWN;
  if (typeof price === 'string' && price.trim() === '') return PRICE_UNKNOWN;
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return PRICE_UNKNOWN;
  if (n === 0) return '무료';
  const { billingPeriod } = options;
  return `$${n}${billingPeriodSuffix(billingPeriod)}`;
};

// 표시용 날짜 포맷: 'YYYY-MM-DD ...' 문자열에서 날짜 부분만 안전하게 취한다.
// 반환 'YYYY.MM.DD'. 파싱 실패(비정상 날짜 문자열)면 null → 호출부에서 메타 점 생략.
// (이전: 앞 10자 폴백 → 잘린 비정상 문자열 노출. FALLBACK 정책과 불일치하여 null로 통일.)
export const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

// 벤치마크 점수 표시: formatPrice/formatUserCount의 방어 패턴(Number + Number.isFinite)을 따른다.
// - 0~max 범위의 유한값 → `N/max` (기본 max=100)
// - null/문자열/NaN/음수/범위초과 → FALLBACK_DASH('-')
// 가격에만 적용됐던 숫자 가드를 점수 셀에도 동일 적용(표현 정합).
export const formatScore = (score, max = 100) => {
  // null/''/공백 등은 Number()가 0으로 강제 변환되므로 사전 차단(0점과 누락을 구분).
  if (score === null || score === undefined) return FALLBACK_DASH;
  if (typeof score === 'string' && score.trim() === '') return FALLBACK_DASH;
  const n = Number(score);
  if (!Number.isFinite(n) || n < 0 || n > max) return FALLBACK_DASH;
  return `${n}/${max}`;
};

// 빈 라벨 안전 표시: 누락/공백 문자열이면 FALLBACK_DASH('-').
// plan/plan_name/description 등 신뢰 불가 라벨 셀에 적용(빈 칸 노출 방지).
export const displayLabel = (value) => {
  if (typeof value !== 'string') return value == null ? FALLBACK_DASH : String(value);
  const trimmed = value.trim();
  return trimmed === '' ? FALLBACK_DASH : trimmed;
};

// 사용자 수를 사람이 읽기 쉬운 약식 표기로 변환.
// - 1,000,000 이상: "1.2M+"
// - 1,000 이상: "12K+"
// - 그 미만(양수): 천 단위 구분 숫자
// - 0/누락/비정상: null 반환(호출부에서 '-' 등으로 처리)
export const formatUserCount = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M+`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K+`;
  }
  return n.toLocaleString();
};

// GitHub stars 약식 표기.
// formatUserCount와 같은 방어 패턴이되 '+' 접미사 없이 스냅샷 수치를 압축한다
// (stars는 추정 범위가 아니라 특정 시점 실측값이므로 '+'를 붙이지 않는다).
// - 1,000,000 이상: "1.2M" / 1,000 이상: "12.3K" / 그 미만(양수): 천 단위 구분
// - 0/누락/비정상: null (호출부에서 배지 미표시)
export const formatMetric = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
};
