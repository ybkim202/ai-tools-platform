import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toolsAPI, handleApiError } from '../services/api';
import ToolCard from './ToolCard';
import Pagination from './Pagination';
import { EmptyFilteredState, ErrorState } from './states/StateViews';
import { ToolGridSkeleton } from './Skeletons';
import '../styles/Home.css';
import '../styles/Explore.css';

// 전체 도구 탐색 UI — 퍼싯 사이드바(카운트·다중선택)/필터 드로어(모바일) + 결과 그리드.
// 정렬/필터/페이지는 전부 서버로 위임. 카테고리/난이도·카운트는 DB 메타에서만(하드코딩 금지).
const PAGE_SIZE = 21;
const SEARCH_DEBOUNCE_MS = 300;
const LICENSE_OPTIONS = [
  { key: 'all', label: '전체', param: undefined },
  { key: 'open', label: '오픈소스', param: true },
  { key: 'prop', label: '독점', param: false },
];
const SORT_LABELS = { popularity: '인기순', name: '이름순', difficulty: '난이도순' };
const SORT_OPTIONS = ['popularity', 'name', 'difficulty'];

const ToolBrowser = () => {
  const [searchParams] = useSearchParams();

  const [tools, setTools] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get('search') || ''
  );
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  // 카테고리 다중선택(Set) — 그룹 내 OR. 빈 Set = '전체'. 딥링크 단일 카테고리 흡수.
  const [selectedCategories, setSelectedCategories] = useState(() => {
    const c = searchParams.get('category');
    return new Set(c ? [c] : []);
  });
  const [selectedDifficulty, setSelectedDifficulty] = useState('전체');
  const [selectedLicense, setSelectedLicense] = useState('all');
  const [sortBy, setSortBy] = useState(() => {
    try {
      return sessionStorage.getItem('home-sort-by') || 'popularity';
    } catch {
      return 'popularity';
    }
  });
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'compact'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [categories, setCategories] = useState(['전체']);
  const [difficulties, setDifficulties] = useState(['전체']);
  // 퍼싯 카운트(전역) — 메타에서. 없으면(구버전 백엔드) 카운트 미표시·전부 활성.
  const [counts, setCounts] = useState({
    category: {},
    difficulty: {},
    license: { open: 0, proprietary: 0 },
    total: 0,
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');

  const isFiltered =
    search !== '' ||
    selectedCategories.size > 0 ||
    selectedDifficulty !== '전체' ||
    selectedLicense !== 'all';

  const activeFacetCount =
    selectedCategories.size +
    (selectedDifficulty !== '전체' ? 1 : 0) +
    (selectedLicense !== 'all' ? 1 : 0);

  const difficultySortDisabled = selectedDifficulty !== '전체';

  useEffect(() => {
    try {
      sessionStorage.setItem('home-sort-by', sortBy);
    } catch {
      /* 영속화만 생략 */
    }
  }, [sortBy]);

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
        setCounts({
          category: meta.category_counts || {},
          difficulty: meta.difficulty_counts || {},
          license: meta.license_counts || { open: 0, proprietary: 0 },
          total: Number(meta.total_tools) || 0,
        });
      })
      .catch(() => {
        /* 메타 실패: '전체'만 유지, 카운트 미표시 */
      });
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [filtersOpen]);

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setSelectedCategories(new Set());
    setSelectedDifficulty('전체');
    setSelectedLicense('all');
    setCatQuery('');
    setCurrentPage(1);
  };

  // ── 활성 필터 칩(라벨 텍스트 항상 포함) ──
  const activeFilters = [];
  if (search !== '') {
    activeFilters.push({
      key: 'search',
      label: '검색',
      value: search,
      onRemove: () => {
        setSearchInput('');
        setSearch('');
        setCurrentPage(1);
      },
    });
  }
  [...selectedCategories].forEach((cat) => {
    activeFilters.push({
      key: `cat:${cat}`,
      label: '카테고리',
      value: cat,
      onRemove: () => {
        setSelectedCategories((prev) => {
          const next = new Set(prev);
          next.delete(cat);
          return next;
        });
        setCurrentPage(1);
      },
    });
  });
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
  if (selectedLicense !== 'all') {
    activeFilters.push({
      key: 'license',
      label: '라이선스',
      value: selectedLicense === 'open' ? '오픈소스' : '독점',
      onRemove: () => {
        setSelectedLicense('all');
        setCurrentPage(1);
      },
    });
  }

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        search: search || undefined,
        category: selectedCategories.size
          ? [...selectedCategories].join(',')
          : undefined,
        difficulty:
          selectedDifficulty !== '전체' ? selectedDifficulty : undefined,
        open_source: LICENSE_OPTIONS.find((o) => o.key === selectedLicense)
          .param,
        sort_by: sortBy,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
      };

      const response = await toolsAPI.getTools(params);
      setTools(
        response.data?.data ||
          (Array.isArray(response.data) ? response.data : [])
      );

      const pagination = response.data?.pagination;
      if (pagination) {
        const pages = Number(pagination.pages) || 1;
        setTotalPages(pages);
        setTotalCount(Number(pagination.total) || 0);
        if (currentPage > pages && pages > 0) setCurrentPage(1);
      }
    } catch (err) {
      setError(handleApiError(err));
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    selectedCategories,
    selectedDifficulty,
    selectedLicense,
    sortBy,
    currentPage,
  ]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const goToPage = (page) => {
    setCurrentPage(page);
    document
      .getElementById('tools')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── 퍼싯 선택 핸들러 ──
  const toggleCategory = (cat) => {
    setCurrentPage(1);
    if (cat === '전체') {
      setSelectedCategories(new Set());
      return;
    }
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const pickDifficulty = (diff) => {
    setSelectedDifficulty(diff);
    setCurrentPage(1);
  };
  const pickLicense = (key) => {
    setSelectedLicense(key);
    setCurrentPage(1);
  };

  // 퍼싯별 카운트('전체'=총계). 카운트 맵이 실제로 있을 때만 표시·0건 비활성.
  // (구버전 백엔드는 total_tools만 주고 *_counts 는 없음 → 미표시·전부 활성으로 폴백.)
  const hasCounts = Object.keys(counts.category).length > 0;
  const catCount = (cat) =>
    !hasCounts ? undefined : cat === '전체' ? counts.total : counts.category[cat] ?? 0;
  const diffCount = (diff) =>
    !hasCounts ? undefined : diff === '전체' ? counts.total : counts.difficulty[diff] ?? 0;
  const licenseCount = (key) => {
    if (!hasCounts) return undefined;
    if (key === 'all') return counts.total;
    return key === 'open' ? counts.license.open : counts.license.proprietary;
  };

  const q = catQuery.trim().toLowerCase();
  const visibleCats = categories.filter(
    (c) => c === '전체' || c.toLowerCase().includes(q)
  );

  // 퍼싯 옵션 — 라벨 + 카운트(있으면). 0건은 비활성('전체' 제외).
  const FacetOption = ({ active, count, disabled, onClick, children }) => (
    <button
      type="button"
      className={`facet-option${active ? ' active' : ''}`}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="facet-option-label">{children}</span>
      {count !== undefined && <span className="facet-count">{count}</span>}
    </button>
  );

  return (
    <div className="explore-browser" id="tools">
      <div className="search-wrapper explore-search">
        <div className="search-input-group">
          <svg
            className="search-icon"
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
            type="text"
            placeholder="도구 이름, 기능으로 검색..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="search-input"
            aria-label="도구 검색"
          />
          {searchInput !== '' && (
            <button
              type="button"
              className="search-clear"
              aria-label="검색어 지우기"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setCurrentPage(1);
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>

      <div className="explore-layout">
        <div
          className={`explore-drawer-overlay${filtersOpen ? ' is-open' : ''}`}
          onClick={() => setFiltersOpen(false)}
          aria-hidden="true"
        />

        <aside
          className={`explore-sidebar${filtersOpen ? ' is-open' : ''}`}
          aria-label="필터"
        >
          <div className="explore-sidebar-head">
            <h2 className="explore-sidebar-title">필터</h2>
            <div className="explore-sidebar-head-actions">
              {isFiltered && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={resetFilters}
                >
                  초기화
                </button>
              )}
              <button
                type="button"
                className="explore-sidebar-close"
                aria-label="필터 닫기"
                onClick={() => setFiltersOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </div>

          <fieldset className="facet-group">
            <legend className="facet-legend">카테고리 (여러 개 선택 가능)</legend>
            <input
              type="text"
              className="facet-search"
              placeholder="카테고리 검색..."
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              aria-label="카테고리 목록 검색"
            />
            <div className="facet-list facet-list--scroll" role="group">
              {visibleCats.map((cat) => {
                const n = catCount(cat);
                const active =
                  cat === '전체'
                    ? selectedCategories.size === 0
                    : selectedCategories.has(cat);
                return (
                  <FacetOption
                    key={cat}
                    active={active}
                    count={n}
                    disabled={cat !== '전체' && n === 0}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </FacetOption>
                );
              })}
              {visibleCats.length === 0 && (
                <p className="facet-empty">일치하는 카테고리가 없어요</p>
              )}
            </div>
          </fieldset>

          <fieldset className="facet-group">
            <legend className="facet-legend">난이도</legend>
            <div className="facet-list facet-list--inline" role="group">
              {difficulties.map((diff) => {
                const n = diffCount(diff);
                return (
                  <FacetOption
                    key={diff}
                    active={selectedDifficulty === diff}
                    count={n}
                    disabled={diff !== '전체' && n === 0}
                    onClick={() => pickDifficulty(diff)}
                  >
                    {diff}
                  </FacetOption>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="facet-group">
            <legend className="facet-legend">라이선스</legend>
            <div className="facet-list facet-list--inline" role="group">
              {LICENSE_OPTIONS.map((opt) => {
                const n = licenseCount(opt.key);
                return (
                  <FacetOption
                    key={opt.key}
                    active={selectedLicense === opt.key}
                    count={n}
                    disabled={opt.key !== 'all' && n === 0}
                    onClick={() => pickLicense(opt.key)}
                  >
                    {opt.label}
                  </FacetOption>
                );
              })}
            </div>
          </fieldset>
        </aside>

        <div className="explore-results">
          <div className="explore-results-bar">
            <button
              type="button"
              className="explore-filter-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(true)}
            >
              필터{activeFacetCount > 0 ? ` (${activeFacetCount})` : ''}
            </button>
            <p className="tools-count" aria-live="polite">
              {loading ? '불러오는 중…' : `${totalCount}개의 AI 도구`}
            </p>
            <div className="explore-viewtoggle" role="group" aria-label="보기 밀도">
              <button
                type="button"
                className={`filter-btn ${viewMode === 'grid' ? 'active' : ''}`}
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                그리드
              </button>
              <button
                type="button"
                className={`filter-btn ${viewMode === 'compact' ? 'active' : ''}`}
                aria-pressed={viewMode === 'compact'}
                onClick={() => setViewMode('compact')}
              >
                촘촘히
              </button>
            </div>
            <div className="tools-sort">
              <span className="filter-label" id="tools-sort-label">
                정렬
              </span>
              <div
                className="filter-buttons tools-sort-chips"
                role="group"
                aria-labelledby="tools-sort-label"
              >
                {SORT_OPTIONS.map((key) => {
                  const disabled =
                    key === 'difficulty' && difficultySortDisabled;
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

          {loading ? (
            <ToolGridSkeleton count={9} />
          ) : error ? (
            <ErrorState
              message={error?.message}
              errorId={error?.errorId}
              onRetry={fetchTools}
            />
          ) : tools.length > 0 ? (
            <>
              <div
                className={`tools-grid${
                  viewMode === 'compact' ? ' tools-grid--compact' : ''
                }`}
              >
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                ariaLabel="페이지 네비게이션"
              />
            </>
          ) : (
            <EmptyFilteredState
              title={
                isFiltered
                  ? '조건에 맞는 결과가 없습니다'
                  : '표시할 도구가 없습니다'
              }
              message="필터나 검색어를 바꿔보세요"
              onReset={isFiltered ? resetFilters : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolBrowser;
