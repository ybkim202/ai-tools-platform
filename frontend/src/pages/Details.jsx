import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolStore, useUIStore } from '../stores/toolStore';
import { benchmarksAPI, newsAPI, toolsAPI } from '../services/api';
import ToolCard from '../components/ToolCard';
import ExternalLinkIcon from '../components/ExternalLinkIcon';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import { formatPrice, formatDate, formatScore, displayLabel } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/Details.css';

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
          message={detailError}
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
  const handleCompareToggle = () => {
    if (isInCompare) {
      removeToolForCompare(selectedTool.id);
    } else {
      addToolForCompare(selectedTool.id, selectedTool.name);
    }
  };

  // task/profession 태그 노출(있을 때만). 백엔드 필드명 변형 대비 안전 추출.
  const detailTags = [
    ...(Array.isArray(selectedTool.tasks) ? selectedTool.tasks : []),
    ...(Array.isArray(selectedTool.professions) ? selectedTool.professions : []),
    ...(Array.isArray(selectedTool.tags) ? selectedTool.tags : []),
  ];

  return (
    <div className="details-page">
      <button className="back-btn" onClick={handleBack}>
        ← {hasHistory ? '뒤로' : '전체 도구 보기'}
      </button>

      <div className="details-header">
        <img
          src={resolveLogoSrc(selectedTool.logo_url, selectedTool.name)}
          alt={selectedTool.name}
          className="logo"
          loading="lazy"
          onError={handleLogoError}
        />
        <div className="header-info">
          {selectedTool.category && (
            <p className="page-eyebrow">{selectedTool.category}</p>
          )}
          <h1 className="page-title">{selectedTool.name}</h1>
          <p className="description">{selectedTool.description}</p>
          <div className="meta">
            <span className="country">{selectedTool.country}</span>
            <span className="difficulty">{selectedTool.difficulty}</span>
          </div>

          {detailTags.length > 0 && (
            <div className="detail-tags">
              {detailTags.map((tag) => (
                <span key={tag} className="status-badge">
                  {tag}
                </span>
              ))}
            </div>
          )}

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
            >
              {isInCompare ? '✓ 비교함' : '비교에 추가'}
            </button>
          </div>
        </div>
      </div>

      <div className="details-content">
        {/* 가격 */}
        {selectedTool.pricing && selectedTool.pricing.length > 0 && (
          <section className="pricing-section">
            <h2>가격</h2>
            <div className="pricing-grid">
              {selectedTool.pricing.map((price) => (
                <div key={price.id} className="pricing-card">
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
              ))}
            </div>
          </section>
        )}

        {/* 벤치마크 — 항상 섹션 렌더(숨김 금지) */}
        <section className="benchmark-section">
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
              <div className="benchmark-grid">
                {Object.entries(benchmarks.benchmarks).map(([type, data]) => (
                  <div key={type} className="benchmark-card">
                    <h3>{type}</h3>
                    <div className="score">{formatScore(data.score)}</div>
                    <p className="source">{data.source}</p>
                  </div>
                ))}
              </div>
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

        {/* 뉴스 — 항상 섹션 렌더(숨김 금지) */}
        <section className="news-section">
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
          <section className="related-section">
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
