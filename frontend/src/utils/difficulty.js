// 난이도 의미 전달 보조 유틸.
// 다크모드는 완전 무채색(채도 0)이라 색만으로 난이도를 구분할 수 없다.
// DESIGN.md 정책: 의미는 "명도 + 점 문자(○◐●) + 텍스트 라벨"로 전달한다.
// 점 문자는 난이도 3단계를 단조 증가하는 채움 정도로 표현해
// 색각·저시력 사용자에게 색과 독립된 시각 채널을 제공한다.
//   쉬움(easy)   → ○ (빈 원)
//   보통(medium) → ◐ (반 채움)
//   어려움(hard) → ● (꽉 채움)
// DB enum이 한글/영문 어느 쪽이어도 동작하도록 양쪽을 매핑한다.

const DIFFICULTY_DOTS = {
  쉬움: '○',
  easy: '○',
  보통: '◐',
  medium: '◐',
  어려움: '●',
  hard: '●',
};

// 매핑되지 않은 난이도 값에 대한 fallback.
// 의미를 거짓으로 단정하지 않도록 중립 점(◌)을 쓴다.
const FALLBACK_DOT = '◌';

/**
 * 난이도 값에 대응하는 점 문자를 반환한다.
 * @param {string} difficulty - 난이도 enum(한글 또는 영문)
 * @returns {string} 점 문자
 */
export function difficultyDot(difficulty) {
  if (!difficulty) return FALLBACK_DOT;
  return DIFFICULTY_DOTS[difficulty] ?? FALLBACK_DOT;
}
