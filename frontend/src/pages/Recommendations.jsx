import React, { useState } from 'react';
import { recommendationsAPI, handleApiError } from '../services/api';
import ToolCard from '../components/ToolCard';
import '../styles/Recommendations.css';

const Recommendations = () => {
  const [recommendations, setRecommendations] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedTab, setSelectedTab] = useState('task');
  const [selectedValue, setSelectedValue] = useState('');

  const tasks = ['콘텐츠작성', '이미지생성', '영상생성', '데이터분석', '코딩'];
  const professions = ['개발자', '디자이너', '마케터', '콘텐츠크리에이터', '데이터분석가'];

  const fetchRecommendations = async (type, value) => {
    setLoading(true);
    setError(null);
    try {
      const response = await recommendationsAPI.getRecommendations(
        type === 'task' ? value : null,
        type === 'profession' ? value : null,
        20
      );
      setRecommendations(response.data.data);
    } catch (err) {
      const error = handleApiError(err);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value) => {
    setSelectedValue(value);
    fetchRecommendations(selectedTab, value);
  };

  return (
    <div className="recommendations-page">
      <div className="recommendations-header">
        <h1>🎁 맞춤 추천</h1>
        <p>당신의 업무와 직업에 맞는 AI 도구를 추천받으세요</p>
      </div>

      <div className="recommendation-tabs">
        <button
          className={`tab ${selectedTab === 'task' ? 'active' : ''}`}
          onClick={() => setSelectedTab('task')}
        >
          📋 업무별
        </button>
        <button
          className={`tab ${selectedTab === 'profession' ? 'active' : ''}`}
          onClick={() => setSelectedTab('profession')}
        >
          👔 직업별
        </button>
      </div>

      <div className="selection-area">
        {selectedTab === 'task' ? (
          <div className="options">
            <h3>업무를 선택하세요</h3>
            <div className="option-grid">
              {tasks.map((task) => (
                <button
                  key={task}
                  className={`option-btn ${selectedValue === task ? 'active' : ''}`}
                  onClick={() => handleSelect(task)}
                >
                  {task}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="options">
            <h3>직업을 선택하세요</h3>
            <div className="option-grid">
              {professions.map((profession) => (
                <button
                  key={profession}
                  className={`option-btn ${selectedValue === profession ? 'active' : ''}`}
                  onClick={() => handleSelect(profession)}
                >
                  {profession}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && <div className="loading">추천을 불러오는 중...</div>}
      {error && <div className="error">{error}</div>}

      {recommendations.length > 0 && (
        <div className="results-section">
          <h2>추천 결과</h2>
          <div className="tools-grid">
            {recommendations.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {!loading && selectedValue && recommendations.length === 0 && !error && (
        <div className="no-results">
          <p>검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
