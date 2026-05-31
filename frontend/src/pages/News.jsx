import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { newsAPI, handleApiError } from '../services/api';
import {
  LoadingState,
  EmptyNoDataState,
  EmptyFilteredState,
  ErrorState,
} from '../components/states/StateViews';
import Pagination from '../components/Pagination';
import ExternalLinkIcon from '../components/ExternalLinkIcon';
import { formatDate } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import '../styles/News.css';

// 한 페이지당 뉴스 수.
const NEWS_LIMIT = 10;
// 검색 디바운스(ms): 입력 멈춤 후 호출.
const SEARCH_DEBOUNCE_MS = 300;

const News = () => {
  // 섹션1: 트렌딩 (독립 상태)
  const [trending, setTrending] = useState([]);
  const [trendingPeriod, setTrendingPeriod] = useState(7);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);

  // 섹션2: 최근 뉴스 (독립 상태) — 페이지네이션 + 검색.
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);
  // 페이지네이션: 1-indexed. totalPages는 서버 pagination.pages에서 채운다.
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // 검색: searchInput은 입력값(즉시), search는 디바운스된 적용값(쿼리에 사용).
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // 뉴스 섹션 상단 — 페이지 이동 시 스크롤 타깃.
  const newsSectionRef = useRef(null);

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

  // 항상 교체(페이지네이션). offset = (page-1)*limit. search는 비어있으면 미전달.
  const fetchNews = useCallback(async (page, searchTerm) => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const res = await newsAPI.getNews({
        days: 30,
        limit: NEWS_LIMIT,
        offset: (page - 1) * NEWS_LIMIT,
        // 백엔드 계약: search(제목/내용/도구명 ILIKE). 빈 문자열은 미전달.
        search: searchTerm || undefined,
      });
      setNews(res.data?.data || []);
      const pages = Number(res.data?.pagination?.pages) || 1;
      setTotalPages(pages);
    } catch (err) {
      setNewsError(handleApiError(err).message);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  // 검색어 디바운스: 입력 멈춤 후 적용값(search)을 갱신 + 1페이지로 리셋.
  // 같은 effect에서 batch → 더블 fetch 방지.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch((prev) => {
        if (prev === searchInput) return prev;
        setCurrentPage(1);
        return searchInput;
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  // 페이지/검색 적용값이 바뀌면 뉴스 재조회(단일 진실 경로).
  useEffect(() => {
    fetchNews(currentPage, search);
  }, [fetchNews, currentPage, search]);

  // 페이지 이동: 상태 변경 후 뉴스 섹션 상단으로 스크롤(맥락 유지).
  const goToPage = (page) => {
    setCurrentPage(page);
    if (newsSectionRef.current) {
      newsSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 검색 초기화(x): 입력·적용값 모두 비우고 1페이지로.
  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setCurrentPage(1);
  };

  const isSearching = search !== '';

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
        <section className="news-section" ref={newsSectionRef}>
          <p className="filter-label">최근 뉴스 · 최근 30일</p>

          {/* 검색 — submit으로도 즉시 적용(디바운스 대기 없이). */}
          <form
            className="news-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setCurrentPage(1);
            }}
          >
            <label className="visually-hidden" htmlFor="news-search-input">
              뉴스 검색
            </label>
            <div className="news-search-group">
              <svg
                className="news-search-icon"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zm4.5-4.5l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <input
                id="news-search-input"
                type="search"
                className="news-search-input"
                placeholder="뉴스 검색(제목·도구명)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  type="button"
                  className="news-search-clear"
                  onClick={clearSearch}
                  aria-label="검색어 지우기"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          </form>

          {newsLoading ? (
            <LoadingState message="뉴스를 불러오는 중..." />
          ) : newsError ? (
            <ErrorState onRetry={() => fetchNews(currentPage, search)} message={newsError} />
          ) : news.length === 0 ? (
            isSearching ? (
              <EmptyFilteredState
                title={`'${search}' 검색 결과가 없습니다`}
                message="다른 검색어로 다시 시도해보세요"
                onReset={clearSearch}
                resetLabel="검색 초기화"
              />
            ) : (
              <EmptyNoDataState
                title="아직 수집된 뉴스가 없습니다"
                message="자동 수집을 준비 중이에요."
                ctaLabel="도구 탐색하기"
                ctaTo="/"
              />
            )
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
                          className="news-source-link"
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          출처
                          <ExternalLinkIcon />
                          <span className="sr-only">(새 창에서 열림)</span>
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>

              {/* 페이지네이션 — 페이지 2개 이상일 때만(컴포넌트가 가드) */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                ariaLabel="뉴스 페이지 네비게이션"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default News;