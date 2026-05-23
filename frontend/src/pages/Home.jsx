import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchTools();
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  const fetchTools = async () => {
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
  };

  return (
    <div className="home-page">
      <div className="home-banner">
        <h1>🚀 모든 AI 도구를 한곳에서!</h1>
        <p>최신 AI 도구를 발견하고, 비교하고, 당신에게 맞는 도구를 추천받으세요</p>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="도구 이름, 기능으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-section">
        <div className="filter-group">
          <label>카테고리</label>
          <div className="filter-options">
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

        <div className="filter-group">
          <label>난이도</label>
          <div className="filter-options">
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

      {loading && <div className="loading-container"><p>로딩 중...</p></div>}
      {error && <div className="error-container"><p>⚠️ {error}</p></div>}

      {!loading && !error && tools && tools.length > 0 && (
        <div className="tools-section">
          <h2>도구 목록 ({tools.length})</h2>
          <div className="tools-grid">
            {tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && (!tools || tools.length === 0) && (
        <div className="empty-state">
          <p>검색 결과가 없습니다.</p>
        </div>
      )}
    </div>
  );
};

export default Home;
