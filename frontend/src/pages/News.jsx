import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { newsAPI, handleApiError } from '../services/api';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/News.css';

const NEWS_LIMIT = 10;

// 표시용 날짜 포맷: 'YYYY-MM-DD ...' 문자열에서 날짜 부분만 안전하게 취한다.
// 누락/비정상 값이면 null(호출부에서 메타 점 생략).
const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // 파싱 실패 시 앞 10자(YYYY-MM-DD)만 폴백 노출.
    return typeof value === 'string' ? value.slice(0, 10) : null;
  }
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

// 출처 URL 안전화: 자동 수집 데이터는 신뢰 불가하므로 http/https 스킴만 허용한다.
// javascript: 등 비허용 스킴은 null 반환 → 호출부에서 링크 미표시(클릭 시 스크립트 실행 차단).
const safeHttpUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? value
      : null;
  } catch {
    return null;
  }
};

const News = () => {
  // 섹션1: 트렌딩 (독립 상태)
  const [trending, setTrending] = useState([]);
  const [trendingPeriod, setTrendingPeriod] = useState(7);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);

  // 섹션2: 최근 뉴스 (독립 상태)
  const [news, setNews] = useState([]);
  const [newsPagination, setNewsPagination] = useState(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMoreLoading, setNewsMoreLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);

  const fetchTrending = useCallback(async () => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const res = await newsAPI.getTrendingNews(7, 12);
      setTrending(res.data?.data || []);
      setTrendingPeriod(res.data?.period_days || 7);
    } catch (err) {
      setTrendingError(handleApiError(err).message);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  // offset 0이면 교체, 그 외엔 기존 목록에 append(더보기).
  const fetchNews = useCallback(async (offset = 0) => {
    if (offset === 0) {
      setNewsLoading(true);
    } else {
      setNewsMoreLoading(true);
    }
    setNewsError(null);
    try {
      const res = await newsAPI.getNews({ days: 30, limit: NEWS_LIMIT, offset });
      const data = res.data?.data || [];
      setNews((prev) => (offset === 0 ? data : [...prev, ...data]));
      setNewsPagination(res.data?.pagination || null);
    } catch (err) {
      setNewsError(handleApiError(err).message);
    } finally {
      setNewsLoading(false);
      setNewsMoreLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
    fetchNews(0);
  }, [fetchTrending, fetchNews]);

  const handleLoadMore = () => {
    if (!newsPagination) return;
    fetchNews(newsPagination.offset + newsPagination.limit);
  };

  const hasMore =
    newsPagination &&
    newsPagination.offset + newsPagination.limit < newsPagination.total;

  return (
    <div className="news-page">
      <div className="page-header">
        <p className="page-eyebrow">트렌드</p>
        <h1 className="page-title">AI 도구 뉴스</h1>
        <p className="page-subtitle">
          최근 업데이트가 활발한 도구와 새 소식을 모았어요
        </p>
      </div>

      <div className="news-container">
        {/* 섹션1: 트렌딩 도구 */}
        <section className="news-section">
          <p className="filter-label">트렌딩 도구 · 최근 {trendingPeriod}일</p>

          {trendingLoading ? (
            <LoadingState message="트렌딩을 불러오는 중..." />
          ) : trendingError ? (
            <ErrorState onRetry={fetchTrending} message={trendingError} />
          ) : trending.length === 0 ? (
            <EmptyNoDataState
              message="아직 수집된 트렌딩 데이터가 없어요(자동 수집 준비 중)."
              inline
            />
          ) : (
            <div className="trending-grid">
              {trending.map((item) => {
                const dateLabel = formatDate(item.latest_news_date);
                return (
                  <Link
                    key={item.tool_id}
                    to={`/details/${item.tool_id}`}
                    className="trending-card"
                    aria-label={`${item.tool_name} 상세, 업데이트 ${item.update_count}건`}
                  >
                    <span className="trending-card-name">{item.tool_name}</span>
                    <span className="trending-card-meta">
                      업데이트 {item.update_count}건
                      {dateLabel && (
                        <>
                          <span aria-hidden="true"> · </span>
                          최근 {dateLabel}
                        </>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* 섹션2: 최근 뉴스 */}
        <section className="news-section">
          <p className="filter-label">최근 뉴스 · 최근 30일</p>

          {newsLoading ? (
            <LoadingState message="뉴스를 불러오는 중..." />
          ) : newsError ? (
            <ErrorState onRetry={() => fetchNews(0)} message={newsError} />
          ) : news.length === 0 ? (
            <EmptyNoDataState
              title="아직 수집된 뉴스가 없습니다"
              message="자동 수집을 준비 중이에요."
              ctaLabel="도구 탐색하기"
              ctaTo="/"
            />
          ) : (
            <>
              <div className="news-list">
                {news.map((item) => {
                  const dateLabel = formatDate(item.news_date);
                  const sourceUrl = safeHttpUrl(item.source_url);
                  return (
                    <article key={item.id} className="news-card">
                      <div className="news-card-meta">
                        <Link
                          to={`/details/${item.tool_id}`}
                          className="news-card-tool"
                        >
                          {item.tool_name}
                        </Link>
                        {dateLabel && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{dateLabel}</span>
                          </>
                        )}
                      </div>
                      <h3 className="news-card-title">{item.title}</h3>
                      {item.content && (
                        <p className="news-card-content">{item.content}</p>
                      )}
                      {sourceUrl && (
                        <a
                          className="news-source-link"
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="출처 열기(새 창)"
                        >
                          출처 →
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>

              {hasMore && (
                <div className="news-more-wrap">
                  <button
                    type="button"
                    className="news-more"
                    onClick={handleLoadMore}
                    disabled={newsMoreLoading}
                  >
                    {newsMoreLoading ? '불러오는 중...' : '더보기'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default News;
