// 페이지 번호 목록 빌더(Home·News 공유). Pagination 컴포넌트 내부에서 사용.

// 페이지 번호 목록: 7개 이하면 전부, 초과면 첫·현재±1·끝 + 말줄임(null).
// null 항목은 호출부에서 말줄임(…)으로 렌더한다.
export const buildPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items = new Set([1, totalPages, currentPage]);
  if (currentPage - 1 > 1) items.add(currentPage - 1);
  if (currentPage + 1 < totalPages) items.add(currentPage + 1);
  const sorted = Array.from(items).sort((a, b) => a - b);
  // 인접하지 않은 구간 사이에 말줄임(null) 삽입.
  const result = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) result.push(null);
    result.push(n);
    prev = n;
  }
  return result;
};
