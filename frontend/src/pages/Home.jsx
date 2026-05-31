import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI, handleApiError } from '../services/api';
import { difficultyRank } from '../utils/difficulty';
import { useUIStore } from '../stores/toolStore';
import ToolCard from '../components/ToolCard';
import { LoadingState, EmptyFilteredState, ErrorState } from '../components/states/StateViews';
import '../styles/Home.css';

const Home = () => {
  const { selectedToolsForCompare, clearCompareList } = useUIStore();
  const compareCount = selectedToolsForCompare.length;
  const [tools, setTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDifficulty, setSelectedDifficulty] = useState('전체');
  // 정렬은 클라이언트 파생값(렌더 시점). 필터/검색과 독립 state로 보존.
  const [sortBy, setSortBy] = useState('popularity');
  // 정렬 옵션 라벨(단일 출처). aria-live 카운트 텍스트와 select 옵션이 공유.
  const SORT_LABELS = { popularity: '인기순', name: '이름순', difficulty: '난이도순' };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 카테고리/난이도는 실제 DB 메타에서 동적으로 채운다(하드코딩 목록 금지).
  // 메타 로드 실패 시에만 '전체' 단일 칩으로 폴백.
  const [categories, setCategories] = useState(['전체']);
  const [difficulties, setDifficulties] = useState(['전체']);

  const isFiltered =
    searchQuery !== '' || selectedCategory !== '전체' || selectedDifficulty !== '전체';

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
  };

  // 활성 필터 칩 목록(라벨 텍스트 항상 포함 — 색 단독 의미전달 금지).
  const activeFilters = [];
  if (searchQuery !== '') {
    activeFilters.push({
      key: 'search',
      label: '검색',
      value: searchQuery,
      onRemove: () => setSearchQuery(''),
    });
  }
  if (selectedCategory !== '전체') {
    activeFilters.push({
      key: 'category',
      label: '카테고리',
      value: selectedCategory,
      onRemove: () => setSelectedCategory('전체'),
    });
  }
  if (selectedDifficulty !== '전체') {
    activeFilters.push({
      key: 'difficulty',
      label: '난이도',
      value: selectedDifficulty,
      onRemove: () => setSelectedDifficulty('전체'),
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
        limit: 100,
      };

      const response = await toolsAPI.getTools(params);
      
      if (response.data && response.data.data) {
        setTools(response.data.data);
      } else if (Array.isArray(response.data)) {
        setTools(response.data);
      } else {
        setTools([]);
      }
    } catch (err) {
      const error = handleApiError(err);
      setError(error.message);
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // 정렬은 원본 tools 불변 유지하며 렌더 시점 파생값으로 처리(fetch 재호출 없음).
  const sortedTools = useMemo(() => {
    const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ko');
    return [...tools].sort((a, b) => {
      if (sortBy === 'name') {
        return byName(a, b);
      }
      if (sortBy === 'difficulty') {
        const diff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
        return diff !== 0 ? diff : byName(a, b);
      }
      // popularity(기본): user_count 내림차순, null은 맨 뒤.
      const ac = typeof a.user_count === 'number' ? a.user_count : -Infinity;
      const bc = typeof b.user_count === 'number' ? b.user_count : -Infinity;
      return bc - ac || byName(a, b);
    });
  }, [tools, sortBy]);

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
                onChange={(e) => setSearchQuery(e.target.value)}
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
                    onClick={() => setSelectedCategory(cat)}
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
                    onClick={() => setSelectedDifficulty(diff)}
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
                    {sortedTools.length}개의 AI 도구 · {SORT_LABELS[sortBy]}
                  </p>
                </div>
                <div className="tools-sort">
                  <label htmlFor="tools-sort-select" className="tools-sort-label">정렬</label>
                  <div className="tools-sort-control">
                    <select
                      id="tools-sort-select"
                      className="tools-sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="popularity">{SORT_LABELS.popularity}</option>
                      <option value="name">{SORT_LABELS.name}</option>
                      <option value="difficulty">{SORT_LABELS.difficulty}</option>
                    </select>
                    <svg
                      className="tools-sort-chevron"
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="tools-grid">
                {sortedTools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
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
