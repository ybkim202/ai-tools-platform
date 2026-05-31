// 로고 이미지 로드 실패 시 표시할 레터-아바타 폴백.
// 외부 네트워크 의존 없이 인라인 SVG(data URI)로 처리한다.
// 도구명 첫 글자를 회색 타일에 그려 도구 간 식별성을 확보한다.
//
// 색은 회색조 고정(무채색). 토큰가드 비대상(JS이며 CSS 아님). 다크모드 미분기
// — SVG data URI는 미디어쿼리 적용 불가하므로 단일 중립 톤만 사용한다.
const AVATAR_BG = '#e5e7eb'; // 배경: border 토큰값 계열의 옅은 회색
const AVATAR_INK = '#6b7280'; // 글자: text-secondary 토큰값(가독성 우선)
const AVATAR_FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// 빈/공백 이름의 중립 placeholder(부정 함의 없는 BULLET)
const EMPTY_GLYPH = '•';

// SVG <text> 내용 XML 이스케이프(글자가 & < > 일 수 있음 — load-bearing).
const escapeXml = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// 도구명에서 첫 "문자"(코드포인트 단위 — 이모지/서로게이트 안전) 추출.
const firstGlyph = (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) return EMPTY_GLYPH;
  const ch = [...trimmed][0];
  // 라틴은 대문자화. 한글/CJK/숫자는 toUpperCase 무해.
  return ch.toUpperCase();
};

// makeLetterAvatar(name) → data:image/svg+xml data URI(레터-아바타)
export const makeLetterAvatar = (name) => {
  const glyph = escapeXml(firstGlyph(name));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    `<rect width="48" height="48" rx="10" fill="${AVATAR_BG}"/>` +
    `<text x="24" y="24" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="${AVATAR_FONT}" font-size="22" font-weight="600" ` +
    `fill="${AVATAR_INK}">${glyph}</text>` +
    '</svg>';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

// 빈 이름 경로의 기본 폴백(중립 BULLET 아바타).
const FALLBACK_LOGO = makeLetterAvatar('');

// 로고 src 선제 해석: logo_url이 빈 문자열/null/undefined면 브라우저가 onError를
// 안정적으로 발화하지 않으므로(빈 src), 처음부터 레터-아바타를 채워 깨진 이미지
// 아이콘 노출을 방지한다. 값이 있으면 그대로 사용하고 onError가 폴백을 담당한다.
export const resolveLogoSrc = (logoUrl, name) => {
  const url = (logoUrl || '').trim();
  return url || makeLetterAvatar(name);
};

// onError 핸들러: 무한 루프 방지를 위해 한 번만 폴백으로 교체한다.
export const handleLogoError = (event) => {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === 'true') {
    return;
  }
  img.dataset.fallbackApplied = 'true';
  const name = (img.alt || '').trim();
  img.src = makeLetterAvatar(name);
};

export default FALLBACK_LOGO;
