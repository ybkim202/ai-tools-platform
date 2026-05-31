import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI, handleApiError } from '../services/api';
import { useUIStore } from '../stores/toolStore';
import ToolCard from '../components/ToolCard';
import Pagination from '../components/Pagination';
import { LoadingState, EmptyFilteredState, ErrorState } from '../components/states/StateViews';
import '../styles/Home.css';

// 페이지당 도구 수(서버 limit 기본값과 일치).
// 그리드가 한 행에 3개씩 → 3의 배수(21 = 3×7)로 두어 마지막 행이 꽉 차게 한다.
const PAGE_SIZE = 21;

const Home = () => {
  const { selectedToolsForCompare, clearCompareList } = useUIStore();
  const compareCount = selectedToolsForCompare.length;
  const [tools, setTools] = useState([]);
  // 페이지네이션: 1-indexed. totalPages/totalCount는 서버 pagination에서 채운다.
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDifficulty, setSelectedDifficulty] = useState('전체');
  // 정렬은 서버 ORDER BY로 위임(sort_by 파라미터). sessionStorage로 영속화.
  // 초기값: 저장값 → 없으면 'popularity'. (theme/compare의 try/catch 가드 패턴 재사용)
  const [sortBy, setSortBy] = useState(() => {
    try {
      return sessionStorage.getItem('home-sort-by') || 'popularity';
    } catch {
      return 'popularity';
    }
  });
  // 정렬 옵션 라벨(단일 출처). aria-live 카운트 텍스트와 정렬 칩이 공유.
  const SORT_LABELS = { popularity: '인기순', name: '이름순', difficulty: '난이도순' };
  // 칩 렌더 순서 보존용 키 목록.
  const SORT_OPTIONS = ['popularity', 'name', 'difficulty'];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 카테고리/난이도는 실제 DB 메타에서 동적으로 채운다(하드코딩 목록 금지).
  // 메타 로드 실패 시에만 '전체' 단일 칩으로 폴백.
  const [categories, setCategories] = useState(['전체']);
  const [difficulties, setDifficulties] = useState(['전체']);

  const isFiltered =
    searchQuery !== '' || selectedCategory !== '전체' || selectedDifficulty !== '전체';

  // 난이도 필터가 활성이면 "난이도순" 정렬은 의미 없음 → 비활성 대상.
  const difficultySortDisabled = selectedDifficulty !== '전체';

  // 정렬값 영속화(저장). 복원은 초기 state에서 처리.
  useEffect(() => {
    try {
      sessionStorage.setItem('home-sort-by', sortBy);
    } catch {
      // 저장 불가(프라이빗 모드 등): 영속화만 생략, 동작은 유지.
    }
  }, [sortBy]);

  // 난이도순이던 중 난이도 필터가 켜지면 인기순으로 폴백(중복 의미 제거).
  // 정렬 변경은 페이지 리셋을 동반한다(같은 effect에서 batch → fetch 1회).
  useEffect(() => {
    if (difficultySortDisabled && sortBy === 'difficulty') {
      setSortBy('popularity');
      setCurrentPage(1);
    }
  }, [difficultySortDisabled, sortBy]);

  useEffect(() => {
    let active = true;
    toolsAPI
      .getMeta()
      .then((res) => {
        if (!active) return;
        const meta = res?.data?.data || {};
        if (Array.isArray(meta.categories) && meta.categories.length > 0) {
          setCategories(['전체', ...meta.categories]);
        }
        if (Array.isArray(meta.difficulties) && meta.difficulties.length > 0) {
          setDifficulties(['전체', ...meta.difficulties]);
        }
      })
      .catch(() => {
        // 메타 로드 실패: '전체'만 유지(과한 스켈레톤 회피).
      });
    return () => {
      active = false;
    };
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('전체');
    setSelectedDifficulty('전체');
    setCurrentPage(1);
  };

  // 활성 필터 칩 목록(라벨 텍스트 항상 포함 — 색 단독 의미전달 금지).
  const activeFilters = [];
  if (searchQuery !== '') {
    activeFilters.push({
      key: 'search',
      label: '검색',
      value: searchQuery,
      onRemove: () => {
        setSearchQuery('');
        setCurrentPage(1);
      },
    });
  }
  if (selectedCategory !== '전체') {
    activeFilters.push({
      key: 'category',
      label: '카테고리',
      value: selectedCategory,
      onRemove: () => {
        setSelectedCategory('전체');
        setCurrentPage(1);
      },
    });
  }
  if (selectedDifficulty !== '전체') {
    activeFilters.push({
      key: 'difficulty',
      label: '난이도',
      value: selectedDifficulty,
      onRemove: () => {
        setSelectedDifficulty('전체');
        setCurrentPage(1);
      },
    });
  }

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: searchQuery || undefined,
        category: selectedCategory !== '전체' ? selectedCategory : undefined,
        difficulty: selectedDifficulty !== '전체' ? selectedDifficulty : undefined,
        // 정렬은 서버 ORDER BY로 위임 — 클라 슬라이스/재정렬 없이 응답 순서를 그대로 렌더.
        sort_by: sortBy,
        // 페이지네이션: 서버 limit/offset로 위임(20개씩).
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      };

      const response = await toolsAPI.getTools(params);

      if (response.data && response.data.data) {
        setTools(response.data.data);
      } else if (Array.isArray(response.data)) {
        setTools(response.data);
      } else {
        setTools([]);
      }

      // 서버 pagination 메타로 전체 페이지/카운트 갱신.
      const pagination = response.data?.pagination;
      if (pagination) {
        const pages = Number(pagination.pages) || 1;
        const total = Number(pagination.total) || 0;
        setTotalPages(pages);
        setTotalCount(total);
        // 방어: 현재 페이지가 범위를 벗어나면(필터로 페이지 수 감소 등) 1로 복귀.
        if (currentPage > pages && pages > 0) {
          setCurrentPage(1);
        }
      }
    } catch (err) {
      const error = handleApiError(err);
      setError(error.message);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedDifficulty, sortBy, currentPage]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // 페이지 이동: 상태 변경 후 결과 영역 상단으로 스크롤(맥락 유지).
  const goToPage = (page) => {
    setCurrentPage(page);
    const target = document.getElementById('tools');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">AI Tools Discovery Platform</div>
          <h1 className="hero-title">모든 AI 도구를<br />한곳에서 발견하세요</h1>
          <p className="hero-subtitle">
            최신 AI 도구를 발견하고, 비교하고, 당신에게 맞는 도구를 추천받으세요
          </p>
          <a href="#tools" className="cta-button">
            도구 탐색하기
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </a>
        </div>
        <div className="hero-gradient"></div>
      </section>

      {/* Search & Filter Section */}
      <section className="search-filter" id="tools">
        <div className="container">
          {/* Search */}
          <div className="search-wrapper">
            <div className="search-input-group">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zm4.5-4.5l3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="도구 이름, 기능으로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="filters-section">
            {/* Category Filter */}
            <div className="filter-group">
              <label className="filter-label">카테고리</label>
              <div className="filter-buttons">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
                    aria-pressed={selectedCategory === cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setCurrentPage(1);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Filter */}
            <div className="filter-group">
              <label className="filter-label">난이도</label>
              <div className="filter-buttons">
                {difficulties.map((diff) => (
                  <button
                    key={diff}
                    className={`filter-btn ${selectedDifficulty === diff ? 'active' : ''}`}
                    aria-pressed={selectedDifficulty === diff}
                    onClick={() => {
                      setSelectedDifficulty(diff);
                      setCurrentPage(1);
                    }}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className={`tools-section ${compareCount > 0 ? 'has-compare-tray' : ''}`}>
        <div className="container">
          {/* Compare Tray (C2) — 선택 도구 있을 때만 */}
          {compareCount > 0 && (
            <div className="compare-tray">
              <div className="compare-tray-left">
                <span className="counter-pill" aria-live="polite">
                  비교함 {compareCount} / 5
                </span>
              </div>
              <div className="compare-tray-actions">
                <Link to="/compare" className="btn btn-primary">
                  비교하기 →
                </Link>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={clearCompareList}
                >
                  비우기
                </button>
              </div>
            </div>
          )}

          {/* Active Filter Chips (C3) */}
          {activeFilters.length > 0 && (
            <div className="active-filters" role="status" aria-live="polite">
              {activeFilters.map((f) => (
                <span key={f.key} className="active-filter-chip">
                  {f.label}: {f.value}
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={f.onRemove}
                    aria-label={`${f.label} 필터 제거`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="ghost-button"
                onClick={resetFilters}
              >
                모두 지우기
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && <LoadingState message="도구를 불러오는 중..." />}

          {/* Error State */}
          {error && !loading && (
            <ErrorState message={error} onRetry={fetchTools} />
          )}

          {/* Tools Grid */}
          {!loading && !error && tools.length > 0 && (
            <>
              <div className="tools-header">
                <div className="tools-header-text">
                  <h2 className="tools-title">발견한 도구</h2>
                  <p className="tools-count" aria-live="polite">
                    {totalCount}개의 AI 도구 · {SORT_LABELS[sortBy]}
                  </p>
                </div>
                <div className="tools-sort">
                  <span className="filter-label" id="tools-sort-label">정렬</span>
                  <div
                    className="filter-buttons tools-sort-chips"
                    role="group"
                    aria-labelledby="tools-sort-label"
                  >
                    {SORT_OPTIONS.map((key) => {
                      const disabled = key === 'difficulty' && difficultySortDisabled;
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`filter-btn ${sortBy === key ? 'active' : ''}`}
                          aria-pressed={sortBy === key}
                          disabled={disabled}
                          title={
                            disabled
                              ? '난이도로 필터 중에는 난이도순 정렬이 의미 없습니다'
                              : undefined
                          }
                          onClick={() => {
                            setSortBy(key);
                            setCurrentPage(1);
                          }}
                        >
                          {SORT_LABELS[key]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="tools-grid">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>

              {/* Pagination — 페이지 2개 이상일 때만(컴포넌트가 가드) */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                ariaLabel="페이지 네비게이션"
              />
            </>
          )}

          {/* Empty State — Home은 전체 도구가 적재되므로 항상 EmptyFiltered */}
          {!loading && !error && tools.length === 0 && (
            <EmptyFilteredState
              title={isFiltered ? '조건에 맞는 결과가 없습니다' : '표시할 도구가 없습니다'}
              message="필터나 검색어를 바꿔보세요"
              onReset={isFiltered ? resetFilters : undefined}
            />
          )}
        </div>
      </section>

      {/* Footer CTA */}
      {!loading && tools.length > 0 && (
        <section className="footer-cta">
          <div className="container">
            <h2>더 많은 기능을 원하신가요?</h2>
            <p>도구 비교, 맞춤 추천 등 더 많은 기능을 지금 바로 사용해보세요</p>
            <div className="cta-buttons">
              <Link to="/compare" className="btn btn-primary">도구 비교</Link>
              <Link to="/recommendations" className="btn btn-secondary">맞춤 추천</Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
