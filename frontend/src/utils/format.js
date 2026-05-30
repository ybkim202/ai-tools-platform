// 표시용 포매터 모음. 데이터가 누락/소수일 때도 안전하게 처리한다.

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
