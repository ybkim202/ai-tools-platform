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

// 난이도 표시 라벨 매핑(한/영 enum 양쪽 → 한글 표시 라벨로 정규화).
// difficultyDot과 동일 단일 출처 원칙: 라벨 매핑도 인라인 금지, 여기서만 관리.
// 점 문자(○◐●)와 라벨 텍스트("쉬움/보통/어려움")의 일관성을 보장한다.
//   쉬움/easy → '쉬움' · 보통/medium → '보통' · 어려움/hard → '어려움'
// 미매핑 값은 원문을 그대로 노출(거짓 단정 금지, raw enum 누출보다 원문 유지가 안전).
const DIFFICULTY_LABELS = {
  쉬움: '쉬움',
  easy: '쉬움',
  보통: '보통',
  medium: '보통',
  어려움: '어려움',
  hard: '어려움',
};

/**
 * 난이도 값에 대응하는 한글 표시 라벨을 반환한다.
 * 매핑되지 않은 값은 원문을 그대로 반환한다(점 문자 FALLBACK과 동일 철학).
 * @param {string} difficulty - 난이도 enum(한글 또는 영문)
 * @returns {string} 표시 라벨
 */
export function difficultyLabel(difficulty) {
  if (!difficulty) return '';
  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

// 정렬용 난이도 rank 매핑(한/영 enum 양쪽 지원).
// difficultyDot과 동일 단일 출처 원칙: 인라인 매핑 금지.
//   쉬움/easy = 0, 보통/medium = 1, 어려움/hard = 2
// 미매핑 값은 맨 뒤로 보내기 위해 큰 값을 반환한다.
const DIFFICULTY_RANKS = {
  쉬움: 0,
  easy: 0,
  보통: 1,
  medium: 1,
  어려움: 2,
  hard: 2,
};

const FALLBACK_RANK = 99;

/**
 * 난이도 값에 대응하는 정렬 rank를 반환한다(쉬움→어려움 오름차순).
 * @param {string} difficulty - 난이도 enum(한글 또는 영문)
 * @returns {number} 정렬 rank(미매핑은 맨 뒤)
 */
export function difficultyRank(difficulty) {
  if (!difficulty) return FALLBACK_RANK;
  return DIFFICULTY_RANKS[difficulty] ?? FALLBACK_RANK;
}
