import React, { useEffect, useState } from 'react';
import { useToolStore, useRecommendationStore } from '../stores/toolStore';
import ToolCard from '../components/ToolCard';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/Home.css';

const Home = () => {
  const { fetchTools, tools, loading, error, pagination, filters, updateFilters, searchTools } = useToolStore();
  const { fetchRecommendations, recommendations: recommendedTools } = useRecommendationStore();
  const [activeTab, setActiveTab] = useState('popular');

  // 초기 로드
  useEffect(() => {
    fetchTools({ limit: 20 });
    fetchRecommendations(null, null, 10);
  }, []);

  // 필터 변경 시 다시 조회
  useEffect(() => {
    const params = {
      limit: filters.limit || 20,
      offset: 0,
    };

    if (filters.search) params.search = filters.search;
    if (filters.category) params.category = filters.category;
    if (filters.country) params.country = filters.country;
    if (filters.difficulty) params.difficulty = filters.difficulty;
    if (filters.sort_by) params.sort_by = filters.sort_by;

    fetchTools(params);
  }, [filters]);

  const handleSearch = (searchValue) => {
    updateFilters({ search: searchValue });
  };

  const handleCategoryFilter = (category) => {
    updateFilters({ category: category === filters.category ? null : category });
  };

  return (
    <div className="home">
      {/* 히어로 섹션 */}
      <section className="hero">
        <div className="hero-content">
          <h1>🤖 AITools</h1>
          <p>모든 AI 도구를 한곳에서 비교하고 추천받으세요</p>
          
          {/* 검색 바 */}
          <div className="search-bar">
            <input
              type="text"
              placeholder="ChatGPT, Claude, DALL-E... 검색하기"
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="search-input"
            />
            <button className="search-btn">🔍</button>
          </div>
        </div>
      </section>

      {/* 메인 콘텐츠 */}
      <div className="main-content">
        {/* 사이드바 - 필터 */}
        <aside className="sidebar">
          <h3>필터</h3>
          
          {/* 카테고리 필터 */}
          <div className="filter-group">
            <h4>카테고리</h4>
            <div className="filter-options">
              {['생성형AI', '이미지생성', '개발도구', '콘텐츠생성'].map((cat) => (
                <button
                  key={cat}
                  className={`filter-btn ${filters.category === cat ? 'active' : ''}`}
                  onClick={() => handleCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 난이도 필터 */}
          <div className="filter-group">
            <h4>난이도</h4>
            <div className="filter-options">
              {['쉬움', '보통', '어려움'].map((diff) => (
                <button
                  key={diff}
                  className={`filter-btn ${filters.difficulty === diff ? 'active' : ''}`}
                  onClick={() => updateFilters({ difficulty: filters.difficulty === diff ? null : diff })}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* 정렬 */}
          <div className="filter-group">
            <h4>정렬</h4>
            <select
              value={filters.sort_by}
              onChange={(e) => updateFilters({ sort_by: e.target.value })}
              className="sort-select"
            >
              <option value="popularity">인기순</option>
              <option value="price">가격순</option>
              <option value="recent">최신순</option>
            </select>
          </div>
        </aside>

        {/* 메인 영역 */}
        <main className="main-area">
          {/* 탭 */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'popular' ? 'active' : ''}`}
              onClick={() => setActiveTab('popular')}
            >
              인기 도구
            </button>
            <button
              className={`tab ${activeTab === 'recommended' ? 'active' : ''}`}
              onClick={() => setActiveTab('recommended')}
            >
              추천 도구
            </button>
          </div>

          {/* 로딩 상태 */}
          {loading && <LoadingSpinner />}

          {/* 에러 상태 */}
          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
            </div>
          )}

          {/* 도구 목록 */}
          {!loading && !error && activeTab === 'popular' && (
            <div className="tools-grid">
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}

          {/* 추천 도구 */}
          {!loading && !error && activeTab === 'recommended' && (
            <div className="tools-grid">
              {recommendedTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}

          {/* 결과 없음 */}
          {!loading && !error && tools.length === 0 && activeTab === 'popular' && (
            <div className="no-results">
              <p>검색 결과가 없습니다.</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {!loading && pagination.pages > 1 && (
            <div className="pagination">
              <p>
                전체 {pagination.total}개 중 {pagination.offset + 1}-
                {Math.min(pagination.offset + pagination.limit, pagination.total)}개 보기
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Home;
