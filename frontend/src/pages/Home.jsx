import React, { useEffect, useState, useCallback } from 'react';
import { toolsAPI, handleApiError } from '../services/api';
import ToolCard from '../components/ToolCard';
import '../styles/Home.css';

const Home = () => {
  const [tools, setTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [selectedDifficulty, setSelectedDifficulty] = useState('전체');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const categories = ['전체', '이미지생성', '영상생성', '텍스트생성', '데이터분석', '코딩'];
  const difficulties = ['전체', '쉬움', '보통', '어려움'];

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
      <section className="tools-section">
        <div className="container">
          {/* Loading State */}
          {loading && (
            <div className="state-container">
              <div className="loading-spinner">
                <div className="spinner"></div>
              </div>
              <p className="state-text">도구를 불러오는 중...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="state-container">
              <div className="error-box">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 8v4m0 4v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="error-title">서버에 연결할 수 없습니다</p>
                <p className="error-message">{error}</p>
                <button onClick={fetchTools} className="retry-button">다시 시도</button>
              </div>
            </div>
          )}

          {/* Tools Grid */}
          {!loading && !error && tools.length > 0 && (
            <>
              <div className="tools-header">
                <h2 className="tools-title">발견한 도구</h2>
                <p className="tools-count">{tools.length}개의 AI 도구</p>
              </div>
              <div className="tools-grid">
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </>
          )}

          {/* Empty State */}
          {!loading && !error && tools.length === 0 && (
            <div className="state-container">
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" fill="currentColor" />
                </svg>
                <p className="empty-title">검색 결과가 없습니다</p>
                <p className="empty-message">필터를 변경하고 다시 시도해보세요</p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('전체');
                    setSelectedDifficulty('전체');
                  }} 
                  className="reset-button"
                >
                  필터 초기화
                </button>
              </div>
            </div>
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
              <a href="/compare" className="btn btn-primary">도구 비교</a>
              <a href="/recommendations" className="btn btn-secondary">맞춤 추천</a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
