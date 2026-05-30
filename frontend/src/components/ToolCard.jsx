import React from 'react';
import { useUIStore } from '../stores/toolStore';
import { formatUserCount } from '../utils/format';
import { handleLogoError } from '../utils/logoFallback';
import '../styles/ToolCard.css';

const ToolCard = ({ tool }) => {
  const { selectedToolsForCompare, addToolForCompare, removeToolForCompare } = useUIStore();
  const isSelected = selectedToolsForCompare.includes(tool.id);

  const handleCompareToggle = (e) => {
    e.preventDefault();
    if (isSelected) {
      removeToolForCompare(tool.id);
    } else {
      addToolForCompare(tool.id, tool.name);
    }
  };

  return (
    <div className="tool-card">
      {/* 헤더 */}
      <div className="card-header">
        <img
          src={tool.logo_url}
          alt={tool.name}
          className="card-logo"
          loading="lazy"
          onError={handleLogoError}
        />
        <div className="card-title-info">
          <h3>{tool.name}</h3>
          <span className="category-badge">{tool.category}</span>
        </div>
      </div>

      {/* 내용 */}
      <div className="card-body">
        <p className="description">{tool.description}</p>

        {/* 메타 정보 */}
        <div className="meta-info">
          {formatUserCount(tool.user_count) && (
            <div className="meta-item">
              <span className="meta-label">사용자</span>
              <span className="meta-value">
                {formatUserCount(tool.user_count)}
              </span>
            </div>
          )}
          
          {tool.country && (
            <div className="meta-item">
              <span className="meta-label">국가</span>
              <span className="meta-value">{tool.country}</span>
            </div>
          )}

          {tool.difficulty && (
            <div className="meta-item">
              <span className="meta-label">난이도</span>
              <span className={`difficulty-badge ${tool.difficulty}`}>
                <span className="difficulty-dot" aria-hidden="true">●</span>
                {tool.difficulty}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="card-footer">
        <a
          href={tool.official_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          방문하기 →
        </a>
        <button
          className={`btn btn-secondary ${isSelected ? 'active' : ''}`}
          onClick={handleCompareToggle}
          title={isSelected ? '비교 제거' : '비교 추가'}
        >
          {isSelected ? '✓ 선택됨' : '비교'}
        </button>
      </div>
    </div>
  );
};

export default ToolCard;
