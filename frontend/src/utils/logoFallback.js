// 로고 이미지 로드 실패 시 표시할 중립 플레이스홀더.
// 외부 네트워크 의존 없이 인라인 SVG(data URI)로 처리한다.
// 색은 회색조 고정(브랜드/팔레트 의미 없음) — 깨진 이미지 아이콘 노출 방지가 목적.
const FALLBACK_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
      '<rect width="48" height="48" rx="10" fill="#e5e7eb"/>' +
      '<path d="M24 14a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 16c6 0 11 3 11 7v1H13v-1c0-4 5-7 11-7z" fill="#9ca3af"/>' +
      '</svg>'
  );

// onError 핸들러: 무한 루프 방지를 위해 한 번만 폴백으로 교체한다.
export const handleLogoError = (event) => {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') {
    return;
  }
  img.dataset.fallbackApplied = 'true';
  img.src = FALLBACK_LOGO;
};

export default FALLBACK_LOGO;
