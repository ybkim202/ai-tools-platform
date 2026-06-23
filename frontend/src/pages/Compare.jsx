import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';
import { compareAPI, handleApiError } from '../services/api';
import { formatUserCount, formatPrice, displayLabel } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import { difficultyDot } from '../utils/difficulty';
import {
  benchmarkTypeLabel,
  benchmarkScore,
  benchmarkSource,
  benchmarkSnapshot,
  formatBenchmarkScore,
} from '../utils/benchmark';
import ExternalLinkIcon from '../components/ExternalLinkIcon';
import {
  LoadingState,
  EmptyNoDataState,
  EmptyFilteredState,
  ErrorState,
} from '../components/states/StateViews';
import { SearchEmptyIcon } from '../components/states/StateIcons';
import '../styles/Compare.css';

// 행 단위 최고값 배지(#2). 색 단독 금지 → 삼각 아이콘(▲)+"최고" 텍스트 2중 채널.
// 셀의 .is-best 굵게/틴트와 함께 쓰여 스캔 없이 우위 도구를 식별하게 한다.
const BestBadge = () => (
  <span className="best-badge" title="이 항목에서 가장 우수">
    <span className="best-badge-icon" aria-hidden="true">▲</span>
    최고
  </span>
);

// embedded=true 면 모달 본문으로 렌더(페이지 헤더/래퍼 생략 — 모달 크롬이 제목·
// 카운터·초기화·닫기를 제공). 기본(false)은 단독 페이지 형태(딥링크 폴백 대비).
const Compare = ({ embedded = false }) => {
  const { selectedToolsForCompare, compareNamesById, clearCompareList } =
    useUIStore();
  const [comparisonData, setComparisonData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchComparison = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await compareAPI.compareTools(selectedToolsForCompare);
      // 표준 포맷: { success, data: { comparison: [...], total_tools: N }, error }.
      const list = response.data?.data?.comparison;
      setComparisonData(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [selectedToolsForCompare]);

  useEffect(() => {
    if (selectedToolsForCompare.length > 0) {
      fetchComparison();
    }
  }, [selectedToolsForCompare, fetchComparison]);

  // 일부 누락 시 빠진 도구의 이름 산출(반환 결과의 id 집합과 선택 id를 diff).
  // 이름은 선택 시점 store 캐시(compareNamesById)에서 읽음 — 추가 API 호출 없음.
  const returnedIds = new Set(
    (comparisonData ?? []).map((tool) => tool?.id)
  );
  const missingToolNames = selectedToolsForCompare
    .filter((id) => !returnedIds.has(id))
    .map((id) => compareNamesById[id] || `#${id}`);

  // ── 행 단위 우열(#2) ──────────────────────────────────────────────
  // 정량 비교 가능 행의 "최고값"을 미리 계산한다. 강조는 비교 대상이
  // 2개 이상일 때만 의미가 있으므로 그때만 maxima를 채운다.
  // null/0(미상) 값은 후보에서 제외하고, 동률이면 셀 비교에서 복수 강조된다.
  const tools = React.useMemo(
    () => comparisonData ?? [],
    [comparisonData]
  );
  const canHighlight = tools.length >= 2;

  const numericUserCount = (tool) => {
    const n = Number(tool?.user_count);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const maxUserCount = React.useMemo(() => {
    if (!canHighlight) return null;
    const values = tools
      .map((t) => {
        const n = Number(t?.user_count);
        return Number.isFinite(n) && n > 0 ? n : null;
      })
      .filter((v) => v !== null);
    return values.length > 0 ? Math.max(...values) : null;
  }, [tools, canHighlight]);

  // 벤치마크는 타입별로 최고 점수가 다르므로 type → maxScore 맵을 만든다.
  // 신규 형식(benchmarks[type] = { score, source, unit })에서 score만 꺼내 비교한다.
  const maxBenchmarkByType = React.useMemo(() => {
    if (!canHighlight) return {};
    const max = {};
    tools.forEach((tool) => {
      const entries = tool?.benchmarks ? Object.entries(tool.benchmarks) : [];
      entries.forEach(([type, value]) => {
        const n = benchmarkScore(value);
        if (n === null) return;
        if (max[type] === undefined || n > max[type]) max[type] = n;
      });
    });
    return max;
  }, [tools, canHighlight]);

  // ── 가로 스크롤 시그니파이어(#10) ─────────────────────────────────
  // 실제 오버플로일 때만, 그리고 끝에 도달하지 않았을 때만 우측 페이드+힌트.
  const scrollRef = React.useRef(null);
  const [showScrollHint, setShowScrollHint] = React.useState(false);

  const updateScrollHint = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflowing = el.scrollWidth > el.clientWidth + 1;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    setShowScrollHint(overflowing && !atEnd);
  }, []);

  useEffect(() => {
    // 데이터/뷰포트 변화 후 오버플로 재측정.
    updateScrollHint();
    window.addEventListener('resize', updateScrollHint);
    return () => window.removeEventListener('resize', updateScrollHint);
  }, [updateScrollHint, comparisonData]);

  if (selectedToolsForCompare.length === 0) {
    return (
      <div className={embedded ? 'compare-embedded' : 'compare-page'}>
        <EmptyNoDataState
          title="비교할 도구를 선택해주세요"
          message="목록에서 도구의 '비교' 버튼을 누르면 여기서 나란히 비교할 수 있어요."
          badge={null}
          icon={<SearchEmptyIcon />}
          ctaLabel="도구 탐색하기"
          ctaTo="/explore"
        />
      </div>
    );
  }

  return (
    <div className={embedded ? 'compare-embedded' : 'compare-page'}>
      {/* 단독 페이지에서만 헤더 — 모달 임베드 시 크롬(제목·카운터·초기화·닫기)은 모달이 제공. */}
      {!embedded && (
        <div className="page-header">
          <p className="page-eyebrow">비교</p>
          <h1 className="page-title">AI 도구 비교</h1>
          <p className="page-subtitle">
            {selectedToolsForCompare.length}개의 도구를 나란히 비교하고 있습니다
          </p>
          <div className="page-header-actions">
            <span className="counter-pill" aria-live="polite">
              선택 {selectedToolsForCompare.length} / 5
            </span>
            <button
              type="button"
              className="ghost-button"
              onClick={clearCompareList}
            >
              초기화
            </button>
          </div>
        </div>
      )}

      {loading && <LoadingState message="비교 정보를 불러오는 중..." />}
      {!loading && error && (
        <ErrorState message={error?.message} errorId={error?.errorId} onRetry={fetchComparison} />
      )}

      {/* 선택은 했으나 결과가 0건: 일부/전체 ID가 DB에 없는 경우 침묵 방지 */}
      {!loading && !error && comparisonData && comparisonData.length === 0 && (
        <EmptyFilteredState
          title="비교 결과를 찾을 수 없습니다"
          message="선택한 도구의 정보를 불러오지 못했어요. 목록을 초기화하고 다시 선택해주세요."
          onReset={clearCompareList}
          resetLabel="선택 초기화"
        />
      )}

      {/* 일부만 누락(결과 수 < 선택 수): 비교는 보여주되 안내 노출 */}
      {!loading && !error && comparisonData && comparisonData.length > 0 &&
        comparisonData.length < selectedToolsForCompare.length && (
        <p className="compare-partial-notice" role="status" aria-live="polite">
          선택한 {selectedToolsForCompare.length}개 중 {comparisonData.length}개의 정보만 표시됩니다.
          {missingToolNames.length > 0 && (
            <>
              {' '}
              <strong className="compare-missing-names">
                {missingToolNames.join(', ')}
              </strong>{' '}
              정보를 불러오지 못했습니다.
            </>
          )}
        </p>
      )}

      {!loading && !error && comparisonData && comparisonData.length > 0 && (
        <>
        {/* 스크롤 래퍼: 실제 오버플로일 때만 우측 페이드+힌트(#10). is-overflow 클래스로 토글. */}
        <div className={`comparison-table-wrap${showScrollHint ? ' is-overflow' : ''}`}>
        <div
          ref={scrollRef}
          className="comparison-table"
          aria-live="polite"
          role="region"
          aria-label="도구 비교 표 (가로로 스크롤하여 더 많은 도구를 볼 수 있습니다)"
          tabIndex={0}
          onScroll={updateScrollHint}
        >
          <table>
            <thead>
              <tr>
                <th>항목</th>
                {comparisonData.map((tool) => (
                  <th key={tool.id}>
                    <Link
                      to={`/details/${tool.id}`}
                      className="compare-tool-link"
                      aria-label={`${tool.name} 상세 보기`}
                    >
                      <img
                        src={resolveLogoSrc(tool.logo_url, tool.name, tool.official_url)}
                        alt={tool.name}
                        className="table-logo"
                        loading="lazy"
                        data-official-url={tool.official_url || ''}
                        onError={handleLogoError}
                      />
                      <span>{tool.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {/* 행 위계(#4): 결정축(가격·벤치마크·사용자 수)을 위로, 메타(카테고리·라이선스·난이도·링크)는 아래·톤 다운. */}
            <tbody>
              {/* 가격 — 결정축 */}
              <tr className="decision-row">
                <td className="label">가격</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {tool.pricing?.length > 0 ? (
                      <div className="pricing-list">
                        {tool.pricing.map((price, idx) => (
                          <div key={idx} className="price-item">
                            <span className="plan">{displayLabel(price.plan)}</span>
                            <span className="price">
                              {formatPrice(price.price, {
                                billingPeriod: price.billing_period,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
              </tr>
              {/* 벤치마크 — 결정축. 강조는 "타입별 최고" 항목 단위(benchmark-item-best)로만
                  한다(#4). 셀 전체 틴트를 쓰면 5개 타입 중 1개만 최고여도 셀이 "전반적 최고"로
                  오독되므로 셀 레벨 is-best는 두지 않는다. 타입은 읽을 라벨, 점수는 /100(#9). */}
              <tr className="decision-row">
                <td className="label">벤치마크</td>
                {comparisonData.map((tool) => {
                  const entries = tool.benchmarks
                    ? Object.entries(tool.benchmarks)
                    : [];
                  return (
                    <td key={tool.id}>
                      {entries.length > 0 ? (
                        <div className="benchmark-list">
                          {entries.map(([type, value]) => {
                            const n = benchmarkScore(value);
                            const source = benchmarkSource(value);
                            const snapshot = benchmarkSnapshot(value);
                            const typeBest =
                              canHighlight &&
                              n !== null &&
                              maxBenchmarkByType[type] !== undefined &&
                              n === maxBenchmarkByType[type];
                            return (
                              <div
                                key={type}
                                className={`benchmark-item${
                                  typeBest ? ' benchmark-item-best' : ''
                                }`}
                              >
                                <span className="type">
                                  {benchmarkTypeLabel(type)}
                                </span>
                                <span className="score">
                                  {formatBenchmarkScore(value)}
                                  {typeBest && <BestBadge />}
                                </span>
                                {/* 출처 · 신선도(언제 측정) — 점수 신뢰 맥락(구체성=신뢰). */}
                                {(source || snapshot) && (
                                  <span className="benchmark-source">
                                    {[source, snapshot]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="cell-empty">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              {/* 사용자 수 — 결정축이자 사회적 증명. 최다 사용자 셀 강조(#2). */}
              <tr className="decision-row">
                <td className="label">사용자 수</td>
                {comparisonData.map((tool) => {
                  const count = numericUserCount(tool);
                  const isBest =
                    canHighlight && count !== null && count === maxUserCount;
                  return (
                    <td key={tool.id} className={isBest ? 'is-best' : undefined}>
                      <span className="user-count-value">
                        {formatUserCount(tool.user_count) ?? '-'}
                      </span>
                      {isBest && <BestBadge />}
                    </td>
                  );
                })}
              </tr>
              {/* 카테고리 — 메타 */}
              <tr className="meta-row">
                <td className="label">카테고리</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>{tool.category}</td>
                ))}
              </tr>
              {/* 라이선스 — 메타 */}
              <tr className="meta-row">
                <td className="label">라이선스</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {/* 핵심 비교축. 색 단독 금지 → 점 문자(◆/◇)+텍스트 2중 채널(카드와 동일). */}
                    {tool.is_open_source ? (
                      <span className="license license-open" title="Open-Source">
                        <span className="license-dot" aria-hidden="true">◆</span>
                        오픈소스
                      </span>
                    ) : (
                      <span className="license license-proprietary" title="Proprietary">
                        <span className="license-dot" aria-hidden="true">◇</span>
                        독점
                      </span>
                    )}
                  </td>
                ))}
              </tr>
              {/* 난이도 — 메타 */}
              <tr className="meta-row">
                <td className="label">난이도</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    <span className={`difficulty ${tool.difficulty}`}>
                      <span className="difficulty-dot" aria-hidden="true">
                        {difficultyDot(tool.difficulty)}
                      </span>
                      {tool.difficulty}
                    </span>
                  </td>
                ))}
              </tr>
              {/* 링크 — 메타 */}
              <tr className="meta-row">
                <td className="label">링크</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {safeHttpUrl(tool.official_url) ? (
                      <a
                        href={safeHttpUrl(tool.official_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-small"
                      >
                        방문
                        <ExternalLinkIcon />
                        <span className="sr-only">(새 창에서 열림)</span>
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
          {/* 오버플로 시에만 노출(끝 도달 시 자동 소거). 페이드는 장식, 힌트는 텍스트로 의미 전달. */}
          <div className="comparison-scroll-hint" aria-hidden="true">
            ← 스크롤 →
          </div>
        </div>

        {/* 모바일 전용: 도구별 세로 카드 스택. 테이블 헤더가 사라지므로
            각 항목 라벨을 카드 안에 명시(접근성). CSS @media로 토글. */}
        <div className="comparison-cards" role="list">
          {comparisonData.map((tool) => (
            <article key={tool.id} className="comparison-card" role="listitem">
              <header className="comparison-card-header">
                <Link
                  to={`/details/${tool.id}`}
                  className="compare-tool-link"
                  aria-label={`${tool.name} 상세 보기`}
                >
                  <img
                    src={resolveLogoSrc(tool.logo_url, tool.name, tool.official_url)}
                    alt={tool.name}
                    className="table-logo"
                    loading="lazy"
                    data-official-url={tool.official_url || ''}
                    onError={handleLogoError}
                  />
                  <span className="comparison-card-name">{tool.name}</span>
                </Link>
              </header>

              {/* 행 위계(#4): 결정축 먼저(가격·벤치마크·사용자 수), 메타는 뒤(.meta-row 톤 다운). */}
              <dl className="comparison-card-rows">
                <div className="comparison-card-row decision-row">
                  <dt>가격</dt>
                  <dd>
                    {tool.pricing?.length > 0 ? (
                      <div className="pricing-list">
                        {tool.pricing.map((price, idx) => (
                          <div key={idx} className="price-item">
                            <span className="plan">{displayLabel(price.plan)}</span>
                            <span className="price">
                              {formatPrice(price.price, {
                                billingPeriod: price.billing_period,
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div className="comparison-card-row decision-row">
                  <dt>벤치마크</dt>
                  <dd>
                    {tool.benchmarks &&
                    Object.keys(tool.benchmarks).length > 0 ? (
                      <div className="benchmark-list">
                        {Object.entries(tool.benchmarks).map(
                          ([type, value]) => {
                            const n = benchmarkScore(value);
                            const source = benchmarkSource(value);
                            const snapshot = benchmarkSnapshot(value);
                            const typeBest =
                              canHighlight &&
                              n !== null &&
                              maxBenchmarkByType[type] !== undefined &&
                              n === maxBenchmarkByType[type];
                            return (
                              <div
                                key={type}
                                className={`benchmark-item${
                                  typeBest ? ' benchmark-item-best' : ''
                                }`}
                              >
                                <span className="type">
                                  {benchmarkTypeLabel(type)}
                                </span>
                                <span className="score">
                                  {formatBenchmarkScore(value)}
                                  {typeBest && <BestBadge />}
                                </span>
                                {/* 출처 · 신선도(언제 측정) — 점수 신뢰 맥락(구체성=신뢰). */}
                                {(source || snapshot) && (
                                  <span className="benchmark-source">
                                    {[source, snapshot]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    ) : (
                      <span className="cell-empty">-</span>
                    )}
                  </dd>
                </div>
                <div className="comparison-card-row decision-row">
                  <dt>사용자 수</dt>
                  <dd>
                    {(() => {
                      const count = numericUserCount(tool);
                      const isBest =
                        canHighlight && count !== null && count === maxUserCount;
                      return (
                        <span className="user-count-cell">
                          <span className="user-count-value">
                            {formatUserCount(tool.user_count) ?? '-'}
                          </span>
                          {isBest && <BestBadge />}
                        </span>
                      );
                    })()}
                  </dd>
                </div>
                <div className="comparison-card-row meta-row">
                  <dt>카테고리</dt>
                  <dd>{tool.category}</dd>
                </div>
                <div className="comparison-card-row meta-row">
                  <dt>라이선스</dt>
                  <dd>
                    {tool.is_open_source ? (
                      <span className="license license-open" title="Open-Source">
                        <span className="license-dot" aria-hidden="true">◆</span>
                        오픈소스
                      </span>
                    ) : (
                      <span className="license license-proprietary" title="Proprietary">
                        <span className="license-dot" aria-hidden="true">◇</span>
                        독점
                      </span>
                    )}
                  </dd>
                </div>
                <div className="comparison-card-row meta-row">
                  <dt>난이도</dt>
                  <dd>
                    <span className={`difficulty ${tool.difficulty}`}>
                      <span className="difficulty-dot" aria-hidden="true">
                        {difficultyDot(tool.difficulty)}
                      </span>
                      {tool.difficulty}
                    </span>
                  </dd>
                </div>
                <div className="comparison-card-row meta-row">
                  <dt>링크</dt>
                  <dd>
                    {safeHttpUrl(tool.official_url) ? (
                      <a
                        href={safeHttpUrl(tool.official_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-small"
                      >
                        방문
                        <ExternalLinkIcon />
                        <span className="sr-only">(새 창에서 열림)</span>
                      </a>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        {/* 5개 미만이면 비교 화면 안에서 도구를 더 담는 동선 제공(과설계 X: 홈으로 안내). */}
        {selectedToolsForCompare.length < 5 && (
          <div className="compare-add-more" role="note">
            <p className="compare-add-more-text">
              최대 5개까지 비교할 수 있어요. 도구를 더 담아 비교해보세요.
            </p>
            <Link to="/" className="btn btn-small">
              홈에서 도구 더 담기 →
            </Link>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default Compare;
