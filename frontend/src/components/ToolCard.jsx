import React from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';
import { formatUserCount, formatMetric } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import { difficultyDot } from '../utils/difficulty';
import ExternalLinkIcon from './ExternalLinkIcon';
import '../styles/ToolCard.css';

const ToolCard = ({ tool, reasonTags }) => {
  const { selectedToolsForCompare, addToolForCompare, removeToolForCompare } = useUIStore();
  const isSelected = selectedToolsForCompare.includes(tool.id);
  // 비교는 최대 5개. 한도 도달 + 미선택 카드의 버튼은 비활성화하고 사유를 노출
  // (조용히 무시 → 사용자가 "고장났다"고 느끼는 문제 방지).
  const compareLimitReached = selectedToolsForCompare.length >= 5;
  const compareDisabled = !isSelected && compareLimitReached;

  const officialUrl = safeHttpUrl(tool.official_url);

  const handleCompareToggle = () => {
    if (isSelected) {
      removeToolForCompare(tool.id);
    } else {
      addToolForCompare(tool.id, tool.name);
    }
  };

  return (
    <div className={`tool-card ${isSelected ? 'selected' : ''}`}>
      <Link
        to={`/details/${tool.id}`}
        className="tool-card-link"
        aria-label={`${tool.name} 상세 보기`}
      >
        {/* 헤더 */}
        <div className="card-header">
          <img
            src={resolveLogoSrc(tool.logo_url, tool.name)}
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
          {tool.description && (
            <p className="description">{tool.description}</p>
          )}

          {/* 메타 정보 */}
          <div className="meta-info">
            {/* 인기지표: GitHub stars(오픈소스) 우선, 없으면 HN points(자동 발견).
                둘 다 없으면 미표시. 라벨 텍스트+아이콘+숫자로 의미를 전달한다
                (색만으로 의미 전달 금지). */}
            {(() => {
              const stars = formatMetric(tool.github_stars);
              if (stars) {
                return (
                  <div className="meta-item">
                    <span className="meta-label">GitHub</span>
                    <span className="meta-value popularity-value">
                      <span className="popularity-icon" aria-hidden="true">★</span>
                      {stars}
                    </span>
                  </div>
                );
              }
              const hn = formatMetric(tool.hn_points);
              if (hn) {
                return (
                  <div className="meta-item">
                    <span className="meta-label">HN</span>
                    <span className="meta-value popularity-value">
                      <span className="popularity-icon" aria-hidden="true">▲</span>
                      {hn}
                    </span>
                  </div>
                );
              }
              return null;
            })()}

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
                  <span className="difficulty-dot" aria-hidden="true">
                    {difficultyDot(tool.difficulty)}
                  </span>
                  {tool.difficulty}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* 매칭 근거 (추천 전용, 링크 바깥) */}
      {Array.isArray(reasonTags) && reasonTags.length > 0 && (
        <div className="match-reason">
          <span className="match-reason-icon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 10l3 3 7-7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span>{reasonTags.join(' · ')} 태그 일치</span>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="card-footer">
        {officialUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            방문하기
            <ExternalLinkIcon />
            <span className="sr-only">(새 창에서 열림)</span>
          </a>
        )}
        <button
          className={`btn btn-secondary ${isSelected ? 'active' : ''}`}
          onClick={handleCompareToggle}
          aria-pressed={isSelected}
          disabled={compareDisabled}
          title={
            isSelected
              ? '비교 제거'
              : compareDisabled
              ? '비교는 최대 5개까지 가능합니다'
              : '비교 추가'
          }
        >
          {isSelected ? '✓ 선택됨' : '비교'}
        </button>
      </div>
    </div>
  );
};

export default ToolCard;
