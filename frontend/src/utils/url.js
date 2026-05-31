// URL 안전화 유틸. 자동 수집/외부 데이터는 신뢰 불가하므로 외부 링크에 일관 적용한다.

// 출처/외부 URL 안전화: 절대 http/https URL만 허용한다.
// - javascript:/mailto: 등 비허용 스킴 → null (클릭 시 스크립트 실행/우회 차단).
// - 상대경로("/path", "foo")·프로토콜-상대("//evil.com") → base 미지정으로 throw → null.
//   (외부 출처 URL은 신뢰 불가하므로 자기 origin으로 절대화하지 않는다 → 오픈 리다이렉트/피싱 차단.)
// - 통과 시 원본이 아닌 parsed.href(정규화된 절대 URL)를 반환한다.
export const safeHttpUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.href
      : null;
  } catch {
    return null;
  }
};
