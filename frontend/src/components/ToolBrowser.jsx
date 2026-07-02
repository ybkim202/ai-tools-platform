import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toolsAPI, handleApiError } from '../services/api';
import ToolCard from './ToolCard';
import Pagination from './Pagination';
import { EmptyFilteredState, ErrorState } from './states/StateViews';
import { ToolGridSkeleton } from './Skeletons';
import '../styles/Home.css';
import '../styles/Explore.css';

// 전체 도구 탐색 UI — 퍼싯 사이드바(데스크톱)/필터 드로어(모바일) + 결과 그리드.
// 정렬/필터/페이지는 전부 서버로 위임(sort_by/limit/offset), 클라 재정렬 없음.
// 카테고리/난이도 목록은 DB 메타에서만 채운다(하드코딩 금지 G5/G6).
const PAGE_SIZE = 21;
const SEARCH_DEBOUNCE_MS = 300;
// 라이선스 필터 옵션(2값 도메인이라 정적 허용 — 하드코딩 카테고리와 무관).
const LICENSE_OPTIONS = [
  { key: 'all', label: '전체', param: undefined },
  { key: 'open', label: '오픈소스', param: true },
  { key: 'prop', label: '독점', param: false },
];

const SORT_LABELS = { popularity: '인기순', name: '이름순', difficulty: '난이도순' };
const SORT_OPTIONS = ['popularity', 'name', 'difficulty'];

const ToolBrowser = () => {
  // 딥링크: /explore?search=q&category=디자인 진입 시 초기값으로 1회 흡수(공유 링크).
  const [searchParams] = useSearchParams();

  const [tools, setTools] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState(
    () => searchParams.get('search') || ''
  );
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(
    () => searchParams.get('category') || '전체'
  );
  const [selectedDifficulty, setSelectedDifficulty] = useState('전체');
  const [selectedLicense, setSelectedLicense] = useState('all');
  const [sortBy, setSortBy] = useState(() => {
    try {
      return sessionStorage.getItem('home-sort-by') || 'popularity';
    } catch {
      return 'popularity';
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 카테고리/난이도는 실제 DB 메타에서 동적으로 채운다(하드코딩 목록 금지).
  const [categories, setCategories] = useState(['전체']);
  const [difficulties, setDifficulties] = useState(['전체']);

  // 모바일 필터 드로어 열림 + 카테고리 퍼싯 내 검색어(긴 목록 정리).
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');

  const isFiltered =
    search !== '' ||
    selectedCategory !== '전체' ||
    selectedDifficulty !== '전체' ||
    selectedLicense !== 'all';

  // 활성 퍼싯(검색 제외) 수 — 모바일 필터 버튼 배지.
  const activeFacetCount = [
    selectedCategory !== '전체',
    selectedDifficulty !== '전체',
    selectedLicense !== 'all',
  ].filter(Boolean).length;

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
        // 메타 로드 실패: '전체'만 유지.
      });
    return () => {
      active = false;
    };
  }, []);

  // 검색어 디바운스: 입력 멈춤 후 적용값(search)을 갱신 + 1페이지로 리셋.
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

  // 모바일 드로어 열릴 때 body 스크롤 잠금 + ESC 닫기.
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
    setSelectedCategory('전체');
    setSelectedDifficulty('전체');
    setSelectedLicense('all');
    setCatQuery('');
    setCurrentPage(1);
  };

  // 활성 필터 칩 목록(라벨 텍스트 항상 포함 — 색 단독 의미전달 금지).
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
        category: selectedCategory !== '전체' ? selectedCategory : undefined,
        difficulty:
          selectedDifficulty !== '전체' ? selectedDifficulty : undefined,
        open_source: LICENSE_OPTIONS.find((o) => o.key === selectedLicense)
          .param,
        sort_by: sortBy,
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

      const pagination = response.data?.pagination;
      if (pagination) {
        const pages = Number(pagination.pages) || 1;
        const total = Number(pagination.total) || 0;
        setTotalPages(pages);
        setTotalCount(total);
        if (currentPage > pages && pages > 0) {
          setCurrentPage(1);
        }
      }
    } catch (err) {
      setError(handleApiError(err));
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [
    search,
    selectedCategory,
    selectedDifficulty,
    selectedLicense,
    sortBy,
    currentPage,
  ]);

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

  const pickCategory = (cat) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };
  const pickDifficulty = (diff) => {
    setSelectedDifficulty(diff);
    setCurrentPage(1);
  };
  const pickLicense = (key) => {
    setSelectedLicense(key);
    setCurrentPage(1);
  };

  // 카테고리 퍼싯 내 검색(클라 필터) — '전체'는 항상 노출.
  const q = catQuery.trim().toLowerCase();
  const visibleCats = categories.filter(
    (c) => c === '전체' || c.toLowerCase().includes(q)
  );

  // 퍼싯 옵션 버튼(재사용).
  const FacetOption = ({ active, onClick, children }) => (
    <button
      type="button"
      className={`facet-option${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="explore-browser" id="tools">
      {/* 검색(전체폭) */}
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
        {/* 모바일 드로어 오버레이 */}
        <div
          className={`explore-drawer-overlay${filtersOpen ? ' is-open' : ''}`}
          onClick={() => setFiltersOpen(false)}
          aria-hidden="true"
        />

        {/* 퍼싯 사이드바(데스크톱)/드로어(모바일) */}
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

          {/* 카테고리 — 목록 + 목록 내 검색(긴 목록 정리) */}
          <fieldset className="facet-group">
            <legend className="facet-legend">카테고리</legend>
            <input
              type="text"
              className="facet-search"
              placeholder="카테고리 검색..."
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              aria-label="카테고리 목록 검색"
            />
            <div className="facet-list facet-list--scroll" role="group">
              {visibleCats.map((cat) => (
                <FacetOption
                  key={cat}
                  active={selectedCategory === cat}
                  onClick={() => pickCategory(cat)}
                >
                  {cat}
                </FacetOption>
              ))}
              {visibleCats.length === 0 && (
                <p className="facet-empty">일치하는 카테고리가 없어요</p>
              )}
            </div>
          </fieldset>

          {/* 난이도 */}
          <fieldset className="facet-group">
            <legend className="facet-legend">난이도</legend>
            <div className="facet-list facet-list--inline" role="group">
              {difficulties.map((diff) => (
                <FacetOption
                  key={diff}
                  active={selectedDifficulty === diff}
                  onClick={() => pickDifficulty(diff)}
                >
                  {diff}
                </FacetOption>
              ))}
            </div>
          </fieldset>

          {/* 라이선스 */}
          <fieldset className="facet-group">
            <legend className="facet-legend">라이선스</legend>
            <div className="facet-list facet-list--inline" role="group">
              {LICENSE_OPTIONS.map((opt) => (
                <FacetOption
                  key={opt.key}
                  active={selectedLicense === opt.key}
                  onClick={() => pickLicense(opt.key)}
                >
                  {opt.label}
                </FacetOption>
              ))}
            </div>
          </fieldset>
        </aside>

        {/* 결과 */}
        <div className="explore-results">
          {/* 결과 툴바: 모바일 필터 버튼 · 개수 · 정렬 */}
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
              <div className="tools-grid">
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
