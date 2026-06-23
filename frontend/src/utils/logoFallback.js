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

// Google s2 파비콘 서비스: official_url 도메인에서 로고를 파생한다(키 불필요·PNG 일관).
// 큐레이션 logo_url 은 시간이 지나면 부패하므로(favicon.ico 404·자산경로 변경·봇 403),
// 도메인 기반 파비콘을 1차 폴백으로 두면 사이트가 로고를 바꿔도 자가치유된다.
const GOOGLE_FAVICON = 'https://www.google.com/s2/favicons';

// official_url → Google s2 파비콘 URL. 도메인 추출 실패 시 null(레터-아바타로 폴백).
// 카드 40px·상세 96px 를 고려해 sz=128(선명도 확보). 순수 함수.
export const faviconFromUrl = (officialUrl, size = 128) => {
  const raw = (officialUrl || '').trim();
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    if (!host) return null;
    return `${GOOGLE_FAVICON}?domain=${encodeURIComponent(host)}&sz=${size}`;
  } catch {
    return null; // 상대경로 등 파싱 불가 URL
  }
};

// 로고 src 선제 해석: logo_url이 빈 문자열/null/undefined면 브라우저가 onError를
// 안정적으로 발화하지 않으므로(빈 src), 처음부터 폴백을 채워 깨진 이미지 아이콘
// 노출을 방지한다. 큐레이션 로고가 없으면 official_url 도메인 파비콘을 우선 시도하고
// (자동 발견 도구는 logo_url 이 비어도 official_url 은 있다), 그것도 없으면 레터-아바타.
// 값이 있으면 그대로 사용하고 onError 가 폴백 체인을 담당한다.
export const resolveLogoSrc = (logoUrl, name, officialUrl) => {
  const url = (logoUrl || '').trim();
  if (url) return url;
  return faviconFromUrl(officialUrl) || makeLetterAvatar(name);
};

// onError 핸들러: 2단 폴백 체인. 큐레이션 로고 실패 → 도메인 파비콘 → 레터-아바타.
// 단계는 data-fallback-step 으로 추적해 무한 루프를 막는다(레터-아바타는 data URI 라
// 다시 onError 가 나지 않으므로 항상 종착). official_url 은 img 의 data-official-url
// 에서 읽는다(컴포넌트가 주입).
export const handleLogoError = (event) => {
  const img = event.currentTarget;
  const step = img.dataset.fallbackStep || 'curated';
  const name = (img.alt || '').trim();

  // 1단계: 큐레이션 logo_url 실패 → official_url 도메인 파비콘으로 자가치유 시도.
  if (step === 'curated') {
    const favicon = faviconFromUrl(img.dataset.officialUrl);
    img.dataset.fallbackStep = favicon ? 'favicon' : 'avatar';
    img.src = favicon || makeLetterAvatar(name);
    return;
  }

  // 2단계: 파비콘도 실패 → 레터-아바타(최종).
  if (step === 'favicon') {
    img.dataset.fallbackStep = 'avatar';
    img.src = makeLetterAvatar(name);
    return;
  }

  // 'avatar': 최종 단계 — 더 교체하지 않는다(무한 루프 방지).
};

export default FALLBACK_LOGO;
