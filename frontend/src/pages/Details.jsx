import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolStore, useUIStore } from '../stores/toolStore';
import { benchmarksAPI, newsAPI, toolsAPI } from '../services/api';
import ToolCard from '../components/ToolCard';
import ExternalLinkIcon from '../components/ExternalLinkIcon';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import {
  formatPrice,
  formatDate,
  formatScore,
  displayLabel,
  formatMetric,
  formatUserCount,
} from '../utils/format';
import { difficultyDot, difficultyLabel } from '../utils/difficulty';
import { formatBenchmarkScore, benchmarkSnapshot } from '../utils/benchmark';
import { safeHttpUrl } from '../utils/url';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/Details.css';

// ── 모델 라인업 표시 헬퍼 (OpenRouter 수집 데이터) ──
const MODALITY_LABEL = {
  text: '텍스트',
  image: '이미지',
  file: '파일',
  audio: '오디오',
  video: '비디오',
};
const TIER_LABEL = { flagship: '플래그십', balanced: '밸런스', fast: '빠름' };

// modality CSV("text,image") → "텍스트·이미지"
const modalityText = (csv) =>
  (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((m) => MODALITY_LABEL[m] || m)
    .join('·');

// 컨텍스트 창(토큰) → "128K" / "8K" / 원값.
const formatContext = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
};

// OpenRouter 단가(토큰당 USD) → "$N/1M"(백만 토큰당) / "무료".
const formatModelPrice = (n) => {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  if (v === 0) return '무료';
  return `$${(v * 1_000_000).toFixed(2)}/1M`;
};

// 스펙 라벨→값 1행(ToolCard .meta-info 패턴 재사용).
const SpecItem = ({ label, children }) => (
  <div className="detail-spec-item">
    <span className="detail-spec-label">{label}</span>
    <span className="detail-spec-value">{children}</span>
  </div>
);

const Details = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchToolDetail, selectedTool, loading, detailError } = useToolStore();
  const {
    selectedToolsForCompare,
    addToolForCompare,
    removeToolForCompare,
  } = useUIStore();

  const [relatedTools, setRelatedTools] = React.useState([]);
  const [relatedLoading, setRelatedLoading] = React.useState(false);
  const [relatedError, setRelatedError] = React.useState(false);

  const [benchmarks, setBenchmarks] = React.useState(null);
  const [benchLoading, setBenchLoading] = React.useState(false);
  const [benchError, setBenchError] = React.useState(false);

  const [news, setNews] = React.useState(null);
  const [newsLoading, setNewsLoading] = React.useState(false);
  const [newsError, setNewsError] = React.useState(false);

  const fetchBenchmarks = React.useCallback(async () => {
    setBenchLoading(true);
    setBenchError(false);
    try {
      const res = await benchmarksAPI.getBenchmarkSummary(id);
      setBenchmarks(res.data.data);
    } catch (err) {
      // 404 = 해당 도구에 벤치마크 데이터 없음 → 에러가 아니라 "준비 중"으로 처리.
      if (err.response?.status === 404) {
        setBenchmarks(null);
      } else {
        setBenchError(true);
      }
    } finally {
      setBenchLoading(false);
    }
  }, [id]);

  const fetchNews = React.useCallback(async () => {
    setNewsLoading(true);
    setNewsError(false);
    try {
      const res = await newsAPI.getToolNews(id, 5);
      setNews(res.data.data);
    } catch (err) {
      // 404 = 해당 도구 뉴스 없음 → 에러가 아니라 "준비 중"으로 처리.
      if (err.response?.status === 404) {
        setNews([]);
      } else {
        setNewsError(true);
      }
    } finally {
      setNewsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchToolDetail(id);
    fetchBenchmarks();
    fetchNews();
  }, [id, fetchToolDetail, fetchBenchmarks, fetchNews]);

  // 관련 도구: 같은 카테고리에서 자기 제외 후 최대 6개(추가 전용 엔드포인트 없음 → 목록 필터).
  const relatedCategory = selectedTool?.category;
  const fetchRelated = React.useCallback(() => {
    if (!relatedCategory) {
      setRelatedTools([]);
      setRelatedError(false);
      setRelatedLoading(false);
      return;
    }
    setRelatedLoading(true);
    setRelatedError(false);
    toolsAPI
      .getTools({ category: relatedCategory, limit: 12 })
      .then((res) => {
        const list = res?.data?.data || [];
        setRelatedTools(
          list.filter((t) => String(t.id) !== String(id)).slice(0, 6)
        );
      })
      .catch(() => {
        setRelatedTools([]);
        setRelatedError(true);
      })
      .finally(() => {
        setRelatedLoading(false);
      });
  }, [relatedCategory, id]);

  useEffect(() => {
    fetchRelated();
  }, [fetchRelated]);

  // 진입 시점의 히스토리 유무를 1회 캡처(라벨 안정화). 외부에서 바로 상세로
  // 진입(히스토리 없음)했는지에 따라 동작/라벨을 맥락에 맞게 분기한다.
  const [hasHistory] = React.useState(
    () => typeof window !== 'undefined' && window.history.length > 1
  );

  // 뒤로가기: 히스토리 있으면 -1, 직접 진입(히스토리 없음)이면 홈 폴백.
  const handleBack = () => {
    if (hasHistory) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // 헤더 상태 3분기: 로딩 / 실패 / 404
  if (loading) {
    return (
      <div className="details-page">
        <LoadingState message="도구 정보를 불러오는 중..." />
      </div>
    );
  }

  if (detailError) {
    return (
      <div className="details-page">
        <ErrorState
          message={detailError?.message}
          errorId={detailError?.errorId}
          onRetry={() => fetchToolDetail(id)}
        />
      </div>
    );
  }

  if (!selectedTool) {
    return (
      <div className="details-page">
        <EmptyNoDataState
          title="도구를 찾을 수 없습니다"
          message="요청하신 도구가 없거나 삭제되었어요."
          badge={null}
          ctaLabel="전체 도구 보기"
          ctaTo="/"
        />
      </div>
    );
  }

  const hasBenchmarks =
    benchmarks &&
    benchmarks.benchmarks &&
    Object.keys(benchmarks.benchmarks).length > 0;

  const isInCompare = selectedToolsForCompare.includes(selectedTool.id);
  // 비교는 최대 5개(카드와 동일 규칙). 한도 도달 + 미선택이면 버튼 비활성 + 사유 노출
  // (조용히 무시 → "고장났다" 인식 방지). ToolCard.jsx의 compareDisabled 패턴 재사용.
  const compareLimitReached = selectedToolsForCompare.length >= 5;
  const compareDisabled = !isInCompare && compareLimitReached;
  const handleCompareToggle = () => {
    if (isInCompare) {
      removeToolForCompare(selectedTool.id);
    } else {
      addToolForCompare(selectedTool.id, selectedTool.name);
    }
  };

  // 헤더 가격 요약(#4): "얼마인가"를 결정 직전 헤더 meta에 한 줄로 끌어올린다.
  // 상세 가격 섹션(.price 2xl/700)은 그대로 유지 — 여기선 요약만.
  // 규칙: 무료 플랜(price 0)이 하나라도 있으면 "무료 플랜 있음", 아니면 유효 양수
  // 최저가를 "시작가 $N"으로. 유효 가격이 전혀 없으면 요약 생략(거짓 단정 금지).
  const pricingPlans = Array.isArray(selectedTool.pricing) ? selectedTool.pricing : [];
  const numericPrices = pricingPlans
    .map((p) => Number(p.price))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const hasFreePlan = numericPrices.some((n) => n === 0);
  const minPaidPrice = numericPrices.filter((n) => n > 0).sort((a, b) => a - b)[0];
  let priceSummary = null;
  if (hasFreePlan) {
    priceSummary = '무료 플랜 있음';
  } else if (Number.isFinite(minPaidPrice)) {
    priceSummary = `시작가 ${formatPrice(minPaidPrice)}`;
  }
  // 가격 카드에서 강조할 최저가(무료 우선). 없으면 강조 안 함.
  const cheapestValue = hasFreePlan
    ? 0
    : Number.isFinite(minPaidPrice)
    ? minPaidPrice
    : null;

  // ── 세분화 파생 데이터 ──
  const repoUrl = selectedTool.github_repo
    ? `https://github.com/${selectedTool.github_repo}`
    : null;
  const models = Array.isArray(selectedTool.models) ? selectedTool.models : [];
  const tasks = Array.isArray(selectedTool.tasks) ? selectedTool.tasks : [];
  const professions = Array.isArray(selectedTool.professions)
    ? selectedTool.professions
    : [];
  const longDesc =
    selectedTool.long_description && selectedTool.long_description.trim()
      ? selectedTool.long_description.trim()
      : null;
  const descSourceUrl = safeHttpUrl(selectedTool.description_source_url);

  // 스펙 그룹 노출 여부(빈 그룹 숨김).
  const userCountLabel = formatUserCount(selectedTool.user_count);
  const starsLabel =
    selectedTool.is_open_source === true
      ? formatMetric(selectedTool.github_stars)
      : null;
  const hnPoints = Number(selectedTool.hn_points);
  const hnLabel = Number.isFinite(hnPoints) && hnPoints > 0 ? hnPoints : null;
  const syncedLabel = formatDate(selectedTool.metrics_synced_at);
  const createdLabel = formatDate(selectedTool.created_at);
  const updatedLabel = formatDate(selectedTool.updated_at);
  const hasPopularityGroup =
    !!userCountLabel || !!starsLabel || !!hnLabel || !!syncedLabel;
  const hasHistoryGroup = !!createdLabel || !!updatedLabel;

  // 벤치마크 카테고리별 그룹핑(summary 데이터의 category 사용, 없으면 '종합').
  const benchByCategory = {};
  if (hasBenchmarks) {
    Object.entries(benchmarks.benchmarks).forEach(([type, data]) => {
      const cat = (data && data.category) || '종합';
      if (!benchByCategory[cat]) benchByCategory[cat] = [];
      benchByCategory[cat].push([type, data]);
    });
  }

  return (
    <div className="details-page">
      <button className="back-btn" onClick={handleBack}>
        ← {hasHistory ? '뒤로' : '전체 도구 보기'}
      </button>

      <div className="details-header">
        <img
          src={resolveLogoSrc(selectedTool.logo_url, selectedTool.name, selectedTool.official_url)}
          alt={selectedTool.name}
          className="logo"
          loading="lazy"
          data-official-url={selectedTool.official_url || ''}
          onError={handleLogoError}
        />
        <div className="header-info">
          {selectedTool.category && (
            <p className="page-eyebrow">{selectedTool.category}</p>
          )}
          <h1 className="page-title">{selectedTool.name}</h1>
          <p className="description">{selectedTool.description}</p>
          {/* 헤더 메타: 결정 직전 핵심 신호만(라이선스·가격요약·난이도). 국가·인기·이력 등
              세분 스펙은 아래 "스펙" 섹션이 라벨→값 구조로 담당(납작한 pill 과밀 해소). */}
          <div className="meta">
            {/* 라이선스: 색 단독 금지 → 점 문자(◆/◇)+텍스트 2중 채널. */}
            {selectedTool.is_open_source ? (
              <span className="license-badge license-open" title="Open-Source">
                <span className="license-dot" aria-hidden="true">◆</span>
                오픈소스
              </span>
            ) : (
              <span className="license-badge license-proprietary" title="Proprietary">
                <span className="license-dot" aria-hidden="true">◇</span>
                독점
              </span>
            )}

            {priceSummary && (
              <span className="meta-pill price-summary-pill">{priceSummary}</span>
            )}

            {selectedTool.difficulty && (
              <span className={`difficulty-badge ${selectedTool.difficulty}`}>
                <span className="difficulty-dot" aria-hidden="true">
                  {difficultyDot(selectedTool.difficulty)}
                </span>
                {difficultyLabel(selectedTool.difficulty)}
              </span>
            )}
          </div>

          <div className="header-actions">
            {safeHttpUrl(selectedTool.official_url) && (
              <a
                href={safeHttpUrl(selectedTool.official_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                공식 사이트 방문
                <ExternalLinkIcon />
                <span className="sr-only">(새 창에서 열림)</span>
              </a>
            )}
            <button
              type="button"
              className={`btn btn-secondary ${isInCompare ? 'active' : ''}`}
              onClick={handleCompareToggle}
              aria-pressed={isInCompare}
              disabled={compareDisabled}
              title={
                isInCompare
                  ? '비교 제거'
                  : compareDisabled
                  ? '비교는 최대 5개까지 가능합니다'
                  : '비교 추가'
              }
            >
              {isInCompare ? '✓ 비교함' : '비교에 추가'}
            </button>
          </div>
        </div>
      </div>

      <div className="details-content">
        {/* 소개 — long_description(위키백과·큐레이션) 있을 때만. 출처 명시(신뢰). */}
        {longDesc && (
          <section className="intro-section">
            <h2>소개</h2>
            <p className="detail-long-desc">{longDesc}</p>
            {(selectedTool.description_source || descSourceUrl) && (
              <p className="detail-source">
                출처:{' '}
                {descSourceUrl ? (
                  <a
                    href={descSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    {selectedTool.description_source === 'wikipedia'
                      ? '위키백과'
                      : selectedTool.description_source || '원문'}
                    <ExternalLinkIcon />
                    <span className="sr-only">(새 창에서 열림)</span>
                  </a>
                ) : (
                  selectedTool.description_source || '큐레이션'
                )}
              </p>
            )}
          </section>
        )}

        {/* 스펙 — 라벨→값 세분 그룹(기본 / 인기·신뢰 / 이력). 헤더 pill 과밀 해소. */}
        <section className="spec-section">
          <h2>스펙</h2>
          <div className="detail-spec-groups">
            <div className="detail-spec-group">
              <h3 className="detail-spec-grouptitle">기본</h3>
              <div className="detail-spec-list">
                {selectedTool.category && (
                  <SpecItem label="카테고리">{selectedTool.category}</SpecItem>
                )}
                {selectedTool.difficulty && (
                  <SpecItem label="난이도">
                    <span className={`difficulty-badge ${selectedTool.difficulty}`}>
                      <span className="difficulty-dot" aria-hidden="true">
                        {difficultyDot(selectedTool.difficulty)}
                      </span>
                      {difficultyLabel(selectedTool.difficulty)}
                    </span>
                  </SpecItem>
                )}
                {selectedTool.country && (
                  <SpecItem label="국가">{selectedTool.country}</SpecItem>
                )}
                <SpecItem label="라이선스">
                  {selectedTool.is_open_source ? '오픈소스' : '독점'}
                  {repoUrl && (
                    <>
                      {' · '}
                      <a
                        href={repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        GitHub
                        <ExternalLinkIcon />
                        <span className="sr-only">(새 창에서 열림)</span>
                      </a>
                    </>
                  )}
                </SpecItem>
              </div>
            </div>

            {hasPopularityGroup && (
              <div className="detail-spec-group">
                <h3 className="detail-spec-grouptitle">인기·신뢰</h3>
                <div className="detail-spec-list">
                  {userCountLabel && (
                    <SpecItem label="사용자 수">
                      {userCountLabel}
                      {(selectedTool.user_count_source ||
                        formatDate(selectedTool.user_count_date)) && (
                        <span className="detail-spec-sub">
                          {[
                            selectedTool.user_count_source,
                            formatDate(selectedTool.user_count_date),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </SpecItem>
                  )}
                  {starsLabel && (
                    <SpecItem label="GitHub">
                      <span className="popularity-icon" aria-hidden="true">
                        ★
                      </span>{' '}
                      {starsLabel}
                    </SpecItem>
                  )}
                  {hnLabel && (
                    <SpecItem label="Hacker News">{hnLabel} points</SpecItem>
                  )}
                  {syncedLabel && (
                    <SpecItem label="지표 갱신">{syncedLabel}</SpecItem>
                  )}
                </div>
              </div>
            )}

            {hasHistoryGroup && (
              <div className="detail-spec-group">
                <h3 className="detail-spec-grouptitle">이력</h3>
                <div className="detail-spec-list">
                  {createdLabel && (
                    <SpecItem label="추가일">{createdLabel}</SpecItem>
                  )}
                  {updatedLabel && (
                    <SpecItem label="갱신일">{updatedLabel}</SpecItem>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 모델 라인업 — models[] 있을 때만(비LLM 도구는 숨김, graceful). */}
        {models.length > 0 && (
          <section className="models-section">
            <h2>모델 라인업</h2>
            <div className="model-grid">
              {models.map((m) => (
                <div
                  key={m.model_slug}
                  className={`model-card${
                    m.is_flagship ? ' model-card--flagship' : ''
                  }`}
                >
                  <div className="model-card-head">
                    <h3 className="model-name">{m.model_name}</h3>
                    {m.tier && (
                      <span className="model-tier">
                        {TIER_LABEL[m.tier] || m.tier}
                      </span>
                    )}
                  </div>
                  <div className="model-specs">
                    {formatContext(m.context_length) && (
                      <span className="model-spec">
                        <span className="model-spec-label">컨텍스트</span>
                        {formatContext(m.context_length)}
                      </span>
                    )}
                    {modalityText(m.input_modalities) && (
                      <span className="model-spec">
                        <span className="model-spec-label">입력</span>
                        {modalityText(m.input_modalities)}
                      </span>
                    )}
                    {formatModelPrice(m.price_input) && (
                      <span className="model-spec">
                        <span className="model-spec-label">입력가</span>
                        {formatModelPrice(m.price_input)}
                      </span>
                    )}
                    {formatModelPrice(m.price_output) && (
                      <span className="model-spec">
                        <span className="model-spec-label">출력가</span>
                        {formatModelPrice(m.price_output)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="detail-source">출처: OpenRouter · 1M 토큰당 단가</p>
          </section>
        )}

        {/* 가격 — 항상 섹션 렌더(숨김 금지). 데이터 없으면 "준비 중" 빈 상태로,
            벤치마크·뉴스·관련 섹션과 동일 패턴. "무료/유료/미상" 불확실성(=의심) 제거. */}
        <section className="pricing-section">
          <h2>가격</h2>
          {selectedTool.pricing && selectedTool.pricing.length > 0 ? (
            <div className="pricing-grid">
              {selectedTool.pricing.map((price) => {
                const pv = Number(price.price);
                const isBest =
                  cheapestValue != null &&
                  Number.isFinite(pv) &&
                  pv === cheapestValue;
                return (
                  <div
                    key={price.id}
                    className={`pricing-card${
                      isBest ? ' pricing-card--best' : ''
                    }`}
                  >
                    {isBest && (
                      <span className="pricing-best-badge">
                        {pv === 0 ? '무료' : '최저가'}
                      </span>
                    )}
                    <h3>{displayLabel(price.plan_name)}</h3>
                    <div className="price">
                      {formatPrice(price.price, {
                        billingPeriod: price.billing_period,
                      })}
                    </div>
                    {price.description && price.description.trim() !== '' && (
                      <p>{price.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyNoDataState
              inline
              title="가격 정보 준비 중"
              message="공개된 가격 정보가 아직 없습니다."
            />
          )}
        </section>

        {/* 벤치마크 — 항상 섹션 렌더(숨김 금지). 비동기 도착을 스크린리더에 알리도록
            aria-busy로 로딩 상태 노출(#18b). 내부 StateViews role=status/alert와
            중복 안내가 나지 않게 컨테이너는 aria-live 없이 aria-busy만 둔다. */}
        <section className="benchmark-section" aria-busy={benchLoading}>
          <h2>성능 벤치마크</h2>
          {benchLoading ? (
            <LoadingState message="벤치마크를 불러오는 중..." />
          ) : benchError ? (
            <ErrorState
              title="벤치마크를 불러오지 못했습니다"
              onRetry={fetchBenchmarks}
            />
          ) : hasBenchmarks ? (
            <>
              {/* 카테고리(추론/코딩/수학/멀티모달/선호/종합)별로 그룹핑해 세분화. */}
              {Object.entries(benchByCategory).map(([cat, entries]) => (
                <div key={cat} className="benchmark-catgroup">
                  <h3 className="benchmark-cattitle">{cat}</h3>
                  <div className="benchmark-grid">
                    {entries.map(([type, data]) => {
                      // 점수는 unit·만점 인지 포맷(formatBenchmarkScore): percent→N/만점,
                      // elo→"N elo"(거짓 /100 금지). 모델·출처·신선도 노출(구체성=신뢰).
                      const snapshot = benchmarkSnapshot(data);
                      return (
                        <div key={type} className="benchmark-card">
                          <h4 className="benchmark-type">{type}</h4>
                          <div className="score">{formatBenchmarkScore(data)}</div>
                          {data.model_version && (
                            <p className="benchmark-model">{data.model_version}</p>
                          )}
                          {(data.source || snapshot) && (
                            <p className="source">
                              {[data.source, snapshot]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="average">평균 점수: {formatScore(benchmarks.average_score)}</p>
            </>
          ) : (
            <EmptyNoDataState
              inline
              title="벤치마크 준비 중"
              message="아직 검증된 벤치마크 점수가 없습니다."
            />
          )}
        </section>

        {/* 활용 — 업무(task)·직군(profession) 태그를 2그룹으로 세분화. 있을 때만. */}
        {(tasks.length > 0 || professions.length > 0) && (
          <section className="tags-section">
            <h2>활용</h2>
            {tasks.length > 0 && (
              <div className="tag-group">
                <h3 className="tag-group-title">이럴 때 좋아요</h3>
                <div className="tag-chips">
                  {tasks.map((t) => (
                    <span key={t} className="status-badge">
                      {displayLabel(t)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {professions.length > 0 && (
              <div className="tag-group">
                <h3 className="tag-group-title">이런 직군에</h3>
                <div className="tag-chips">
                  {professions.map((p) => (
                    <span key={p} className="status-badge">
                      {displayLabel(p)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* 뉴스 — 항상 섹션 렌더(숨김 금지). 비동기 도착 안내용 aria-busy(#18b). */}
        <section className="news-section" aria-busy={newsLoading}>
          <h2>최신 뉴스</h2>
          {newsLoading ? (
            <LoadingState message="뉴스를 불러오는 중..." />
          ) : newsError ? (
            <ErrorState
              title="뉴스를 불러오지 못했습니다"
              onRetry={fetchNews}
            />
          ) : news && news.length > 0 ? (
            <div className="news-list">
              {news.map((item) => {
                const dateLabel = formatDate(item.news_date);
                const sourceUrl = safeHttpUrl(item.source_url);
                return (
                  <div key={item.id} className="news-card">
                    {dateLabel && (
                      <div className="news-card-meta">
                        <span>{dateLabel}</span>
                      </div>
                    )}
                    <h3 className="news-card-title">
                      {item.title_ko || item.title}
                    </h3>
                    {item.title_ko && item.title_ko !== item.title && (
                      <p className="news-card-original" lang="en">
                        {item.title}
                      </p>
                    )}
                    {(item.summary_ko || item.content) && (
                      <p className="news-card-content">
                        {item.summary_ko || item.content}
                      </p>
                    )}
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        원문 보기
                        <ExternalLinkIcon />
                        <span className="sr-only">(새 창에서 열림)</span>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyNoDataState
              inline
              title="뉴스 준비 중"
              message="수집된 뉴스가 아직 없습니다."
            />
          )}
        </section>

        {/* 관련 도구 — 같은 카테고리(자기 제외). 항상 섹션 렌더 + 상태뷰(레이아웃 점프/증발 방지) */}
        {relatedCategory && (
          <section className="related-section" aria-busy={relatedLoading}>
            <h2>관련 도구</h2>
            {relatedLoading ? (
              <LoadingState message="관련 도구를 불러오는 중..." />
            ) : relatedError ? (
              <ErrorState
                title="관련 도구를 불러오지 못했습니다"
                onRetry={fetchRelated}
              />
            ) : relatedTools.length > 0 ? (
              <div className="tools-grid">
                {relatedTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            ) : (
              <EmptyNoDataState
                inline
                badge={null}
                title="관련 도구 없음"
                message="같은 카테고리의 다른 도구가 아직 없습니다."
              />
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Details;
