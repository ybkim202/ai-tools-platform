import React, { useState, useEffect, useCallback, useRef } from 'react';
import { trendingAPI, handleApiError } from '../services/api';
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
import '../styles/GithubTrends.css';

// 한 페이지당 레포 수.
const REPO_LIMIT = 12;
// 범위 옵션 — 라디오 그룹 단일 진실.
const PERIODS = [
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
];

// 별점 압축 표기(1,234 → 1.2k). 원수치는 호출부에서 title/aria로 동반.
// 누락/비정상은 null(호출부에서 별점 메타 자체를 생략).
const formatStars = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString();
};

// 별 아이콘(장식) — 채도색 금지, 잉크 틴트(.star-icon)로 통일.
const StarIcon = () => (
  <svg
    className="star-icon"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9L12 2.5z" />
  </svg>
);

const InfoIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5m0-9v.01" />
  </svg>
);

const GithubTrends = () => {
  const [repos, setRepos] = useState([]);
  const [themes, setThemes] = useState([]);
  const [total, setTotal] = useState(0);
  const [collectedAt, setCollectedAt] = useState(null);

  const [period, setPeriod] = useState('weekly');
  const [activeTheme, setActiveTheme] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 결과 영역 상단 — 페이지 이동 시 스크롤 타깃(헤더/필터 고정, 레이아웃 점프 방지).
  const resultsRef = useRef(null);
  // 세그먼트 라디오 포커스 이동용.
  const segmentRefs = useRef([]);
  // 툴팁 + 드롭다운식이 아니므로 단순 토글 상태만 둔다.
  const [tipOpen, setTipOpen] = useState(false);

  const fetchTrending = useCallback(async (p, theme, page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await trendingAPI.getGithubTrending({
        period: p,
        theme,
        limit: REPO_LIMIT,
        offset: (page - 1) * REPO_LIMIT,
      });
      const data = res.data?.data || {};
      const repoList = data.repos || [];
      const totalCount = Number(data.total) || repoList.length;
      setRepos(repoList);
      setThemes(data.themes || []);
      setTotal(totalCount);
      setCollectedAt(data.collected_at || null);
      // 서버 pagination.pages를 우선 신뢰하되, 누락 시 total/limit로 보강(2페이지 진입 불가 방지).
      const serverPages = Number(res.data?.pagination?.pages);
      const derivedPages = Math.max(1, Math.ceil(totalCount / REPO_LIMIT));
      setTotalPages(
        Number.isFinite(serverPages) && serverPages > 0
          ? serverPages
          : derivedPages
      );
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending(period, activeTheme, currentPage);
  }, [fetchTrending, period, activeTheme, currentPage]);

  const selectPeriod = (value) => {
    if (value === period) return;
    setPeriod(value);
    setActiveTheme('all');
    setCurrentPage(1);
  };

  // radiogroup 키보드: Arrow 이동 + 즉시 선택.
  const onSegmentKeyDown = (e, idx) => {
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    const backward = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    if (!forward && !backward) return;
    e.preventDefault();
    const dir = forward ? 1 : -1;
    const next = (idx + dir + PERIODS.length) % PERIODS.length;
    selectPeriod(PERIODS[next].value);
    segmentRefs.current[next]?.focus();
  };

  // 칩 단일 토글: 같은 칩 재클릭 시 '전체'로 복귀.
  const toggleTheme = (key) => {
    setActiveTheme((prev) => (prev === key ? 'all' : key));
    setCurrentPage(1);
  };

  const goToPage = (page) => {
    setCurrentPage(page);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const resetTheme = () => {
    setActiveTheme('all');
    setCurrentPage(1);
  };

  const oppositePeriod = period === 'weekly' ? 'monthly' : 'weekly';
  const isFiltered = activeTheme !== 'all';
  const freshness = formatDate(collectedAt);

  // 결과 요약 라인 문구: 필터 없으면 '전체', 있으면 활성 테마 라벨.
  const activeThemeLabel =
    themes.find((t) => t.key === activeTheme)?.label || '전체';
  const summaryLabel = isFiltered ? activeThemeLabel : '전체';

  // count 0 테마는 렌더하지 않음(빈 결과 방지). 'all'은 항상 노출.
  const visibleThemes = themes.filter(
    (t) => t.key === 'all' || Number(t.count) > 0
  );

  return (
    <div className="trends-page">
      <div className="page-header">
        <p className="page-eyebrow">트렌드</p>
        <div className="trend-title-row">
          <h1 className="page-title">깃헙 트렌드</h1>
          <span
            className="info-tip"
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
          >
            <button
              type="button"
              className="info-tip-btn"
              aria-label="트렌딩 기준 안내"
              aria-expanded={tipOpen}
              aria-describedby="trend-tip-bubble"
              onClick={() => setTipOpen((v) => !v)}
              onFocus={() => setTipOpen(true)}
              onBlur={() => setTipOpen(false)}
            >
              <InfoIcon />
            </button>
            <span
              id="trend-tip-bubble"
              className="info-tip-bubble"
              role="tooltip"
              hidden={!tipOpen}
            >
              트렌딩 = 최근 생성 + 고별점. 오래된 인기 레포(예: PyTorch)는 포함되지
              않습니다.
            </span>
          </span>
        </div>
        <p className="page-subtitle">
          최근 생성된 급부상 오픈소스를 별점순으로. 주간=7일, 월간=30일 내 생성.
        </p>

        <div className="page-header-actions">
          <div className="segmented" role="radiogroup" aria-label="기간 선택">
            {PERIODS.map((opt, idx) => {
              const isActive = period === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  tabIndex={isActive ? 0 : -1}
                  ref={(el) => {
                    segmentRefs.current[idx] = el;
                  }}
                  className={`segmented-item${isActive ? ' is-active' : ''}`}
                  onClick={() => selectPeriod(opt.value)}
                  onKeyDown={(e) => onSegmentKeyDown(e, idx)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {freshness && (
            <span className="trend-freshness">업데이트: {freshness}</span>
          )}
        </div>
      </div>

      <div className="trends-container">
        {/* 주제 군집 칩 — count 0 미표시, 'all' 기본 활성, 단일 토글 */}
        {visibleThemes.length > 1 && (
          <div className="theme-filter" role="group" aria-label="주제 군집 필터">
            {visibleThemes.map((t) => {
              const isActive = activeTheme === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`filter-btn theme-chip${isActive ? ' active' : ''}`}
                  aria-pressed={isActive}
                  disabled={loading}
                  onClick={() => toggleTheme(t.key)}
                >
                  {t.label}
                  {Number.isFinite(Number(t.count)) && t.key !== 'all' && (
                    <span className="chip-count">{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <section className="trend-results" ref={resultsRef} aria-busy={loading}>
          {loading ? (
            <LoadingState message="트렌딩을 불러오는 중..." />
          ) : error ? (
            <ErrorState
              onRetry={() => fetchTrending(period, activeTheme, currentPage)}
              message={error?.message}
              errorId={error?.errorId}
            />
          ) : repos.length === 0 ? (
            isFiltered ? (
              <EmptyFilteredState
                title="이 주제에 해당하는 레포가 없어요"
                message="다른 주제를 고르거나 전체에서 살펴보세요."
                onReset={resetTheme}
                resetLabel="전체 보기"
              />
            ) : (
              <EmptyNoDataState
                title="이 기간에 표시할 트렌딩이 없어요"
                message="다른 기간을 선택해보세요."
                ctaLabel={`${oppositePeriod === 'monthly' ? '월간' : '주간'} 보기`}
                onCta={() => selectPeriod(oppositePeriod)}
              />
            )
          ) : (
            <>
              <p className="trend-result-summary">
                {summaryLabel} · {total}개
              </p>

              <div className="repo-grid">
                {repos.map((repo) => {
                  const url = safeHttpUrl(repo.html_url);
                  const avatarUrl = safeHttpUrl(repo.avatar_url);
                  const ownerRepo = repo.owner
                    ? `${repo.owner}/${repo.repo || repo.name}`
                    : repo.repo || repo.name;
                  const starsText = formatStars(repo.stars);
                  const starsExact = Number(repo.stars);
                  const hasKo =
                    repo.description_ko &&
                    repo.description_ko !== repo.description;
                  const descText =
                    repo.description_ko || repo.description || '';
                  const topics = Array.isArray(repo.topics)
                    ? repo.topics.slice(0, 3)
                    : [];

                  const CardTag = url ? 'a' : 'article';
                  const cardProps = url
                    ? {
                        href: url,
                        target: '_blank',
                        rel: 'noopener noreferrer',
                        'aria-label': `${ownerRepo} 깃헙 레포 (새 창에서 열림)`,
                      }
                    : {};

                  return (
                    <CardTag
                      key={repo.id || repo.html_url || ownerRepo}
                      className="repo-card"
                      {...cardProps}
                    >
                      <div className="repo-card-head">
                        <span className="repo-owner">
                          {avatarUrl && (
                            <img
                              className="repo-owner-avatar"
                              src={avatarUrl}
                              alt=""
                              loading="lazy"
                              width="28"
                              height="28"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span className="repo-owner-name">{ownerRepo}</span>
                        </span>
                        {starsText && (
                          <span
                            className="repo-stars"
                            title={
                              Number.isFinite(starsExact)
                                ? `별 ${starsExact.toLocaleString()}개`
                                : undefined
                            }
                            aria-label={
                              Number.isFinite(starsExact)
                                ? `별 ${starsExact.toLocaleString()}개`
                                : undefined
                            }
                          >
                            <StarIcon />
                            {starsText}
                          </span>
                        )}
                      </div>

                      <h2 className="repo-name">{repo.name || repo.repo}</h2>

                      {descText ? (
                        <p className="repo-desc">{descText}</p>
                      ) : (
                        <p className="repo-desc repo-desc-empty">
                          설명이 없는 레포예요.
                        </p>
                      )}
                      {hasKo && (
                        <p className="repo-desc-fallback" lang="en">
                          {repo.description}
                        </p>
                      )}

                      <div className="repo-meta">
                        {repo.language && (
                          <span className="repo-lang">
                            <span
                              className="repo-lang-dot"
                              aria-hidden="true"
                            ></span>
                            {repo.language}
                          </span>
                        )}
                        {topics.map((topic) => (
                          <span key={topic} className="repo-topic">
                            #{topic}
                          </span>
                        ))}
                      </div>

                      {url && (
                        <span className="repo-link">
                          깃헙에서 보기
                          <ExternalLinkIcon />
                          <span className="sr-only">(새 창에서 열림)</span>
                        </span>
                      )}
                    </CardTag>
                  );
                })}
              </div>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                ariaLabel="트렌딩 페이지 네비게이션"
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default GithubTrends;
