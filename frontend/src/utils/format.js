// 표시용 포매터 모음. 데이터가 누락/소수일 때도 안전하게 처리한다.

// 빈값/비정상 표기 공통 상수(가격·날짜·사용자 수 등 메타 위계). 색은 호출부에서 tertiary 권장.
export const FALLBACK_DASH = '-';

// 가격 표시: formatUserCount의 방어 패턴(Number 변환 + Number.isFinite + 폴백)을 따른다.
// - price === 0            → '무료'
// - 양수 유한값            → `$N` (옵션 billingPeriod 있으면 `$N/기간`)
// - 음수/null/NaN/비정상   → FALLBACK_DASH('-')
// options.billingPeriod는 D3(가격 정책) 확정 전까지 옵션. Compare는 미전달(현행 유지), Details는 전달.
// (통화 변환·원화 병기는 D3 영역 → 미포함. 시그니처는 옵션 추가만으로 확장 호환.)
export const formatPrice = (price, options = {}) => {
  const n = Number(price);
  if (n === 0) return '무료';
  if (!Number.isFinite(n) || n < 0) return FALLBACK_DASH;
  const base = `$${n}`;
  const { billingPeriod } = options;
  if (typeof billingPeriod === 'string' && billingPeriod !== '') {
    return `${base}/${billingPeriod}`;
  }
  return base;
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
