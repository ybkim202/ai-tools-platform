// 벤치마크 표시 보조 유틸.
// compare API의 benchmarks는 { benchmark_type: { score, source, unit } } 중첩 객체다.
//   - score: 숫자 점수(없으면 null)
//   - source: 출처 문자열(예: "Artificial Analysis") — 있을 때만 보조 텍스트로 표기
//   - unit: 'percent'면 /100 맥락, 그 외엔 접미사로 사용
// (구버전은 값=숫자였음. benchmarkScore가 두 형식을 모두 안전하게 흡수한다.)
// benchmark_type은 원시 enum(예: "mmlu", "code_generation")으로 올 수 있어
// 사람이 읽을 라벨로 변환한다. 매핑되지 않은 값은 스네이크/케밥 케이스를
// 공백·대문자화하여 그대로 노출한다(거짓 라벨을 만들지 않음).

import { formatScore, FALLBACK_DASH } from './format';

// 알려진 벤치마크 타입 → 표시 라벨. 단일 출처(인라인 매핑 금지).
const BENCHMARK_TYPE_LABELS = {
  mmlu: 'MMLU',
  gpqa: 'GPQA',
  humaneval: 'HumanEval',
  human_eval: 'HumanEval',
  math: 'MATH',
  gsm8k: 'GSM8K',
  code_generation: '코드 생성',
  reasoning: '추론',
  speed: '속도',
  accuracy: '정확도',
};

/**
 * 벤치마크 타입 enum을 읽기 좋은 라벨로 변환한다.
 * @param {string} type - 원시 벤치마크 타입
 * @returns {string} 표시 라벨
 */
export function benchmarkTypeLabel(type) {
  if (typeof type !== 'string' || type.trim() === '') return '-';
  const key = type.trim().toLowerCase();
  if (BENCHMARK_TYPE_LABELS[key]) return BENCHMARK_TYPE_LABELS[key];
  // 미매핑: snake_case/kebab-case를 공백으로 풀고 각 단어 첫 글자 대문자화.
  return type
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * 벤치마크 항목 값에서 점수를 안전하게 꺼낸다.
 * 신규 형식({ score, source, unit })과 구버전(숫자 직접)을 모두 흡수한다.
 * @param {object|number|string|null} value - benchmarks[type] 값
 * @returns {number|null} 유한한 숫자 점수, 없으면 null
 */
export function benchmarkScore(value) {
  const raw =
    value !== null && typeof value === 'object' ? value.score : value;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 벤치마크 항목의 출처 문자열을 안전하게 꺼낸다(없으면 null).
 * @param {object|number|string|null} value - benchmarks[type] 값
 * @returns {string|null}
 */
export function benchmarkSource(value) {
  if (value === null || typeof value !== 'object') return null;
  const src = value.source;
  return typeof src === 'string' && src.trim() !== '' ? src.trim() : null;
}

/**
 * 벤치마크 항목의 단위를 안전하게 꺼낸다(없으면 null).
 * @param {object|number|string|null} value - benchmarks[type] 값
 * @returns {string|null}
 */
export function benchmarkUnit(value) {
  if (value === null || typeof value !== 'object') return null;
  const unit = value.unit;
  return typeof unit === 'string' && unit.trim() !== '' ? unit.trim() : null;
}

/**
 * 벤치마크 점수를 단위 맥락과 함께 표시 문자열로 만든다.
 * - unit==='percent'(또는 미지정): formatScore로 `N/100` (만점 맥락 유지)
 * - 그 외 unit: `N <unit>` (예: "1280 elo") — 거짓 만점 맥락을 만들지 않음
 * - 점수 없음/비정상: FALLBACK_DASH('-')
 * @param {object|number|string|null} value - benchmarks[type] 값
 * @returns {string}
 */
export function formatBenchmarkScore(value) {
  const score = benchmarkScore(value);
  if (score === null) return FALLBACK_DASH;
  const unit = benchmarkUnit(value);
  if (unit === null || unit === 'percent') {
    return formatScore(score);
  }
  return `${score} ${unit}`;
}
