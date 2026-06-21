import React from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';
import { formatUserCount, formatMetric } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import { difficultyDot, difficultyLabel } from '../utils/difficulty';
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

  // 정보 위계 승격(#5): 핵심 지표 1개를 카드에서 강조한다.
  // 우선순위는 GitHub stars(오픈소스 한정) → user_count. 둘 다 없으면 강조하지 않는다
  // (빈 강조 금지). 강조 지표는 메타 목록에서 제외해 중복 노출을 피한다.
  const starsValue =
    tool.is_open_source === true ? formatMetric(tool.github_stars) : null;
  const userCountValue = formatUserCount(tool.user_count);
  // 아이콘은 무채색 글리프만 사용한다(컬러 이모지 금지 — AI slop·OS별 렌더 편차).
  // stars는 ★ 글리프, user_count는 적합한 단색 글리프 어휘가 없어 아이콘을 생략하고
  // 숫자 + sr-only 라벨로 의미를 전달한다(라벨 텍스트가 의미 채널).
  const headlineMetric = starsValue
    ? { kind: 'stars', icon: '★', label: 'GitHub stars', value: starsValue }
    : userCountValue
    ? { kind: 'users', icon: null, label: '사용자 수', value: userCountValue }
    : null;

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

          {/* 핵심 지표 승격(#5): GitHub stars > user_count 순으로 1개만 강조.
              아이콘 + 숫자 + 의미 라벨(sr-only)을 병행해 색·크기 단독 의미 전달을 피한다.
              둘 다 없으면 렌더하지 않는다(빈 강조 금지). */}
          {headlineMetric && (
            <div className="card-headline-metric">
              {headlineMetric.icon && (
                <span className="headline-metric-icon" aria-hidden="true">
                  {headlineMetric.icon}
                </span>
              )}
              <span className="headline-metric-value">{headlineMetric.value}</span>
              <span className="sr-only">{headlineMetric.label}</span>
            </div>
          )}

          {/* 메타 정보(보조) — 승격된 지표는 여기서 제외해 중복 노출을 막는다. */}
          <div className="meta-info">
            {/* 라이선스: 항상 표시. 입문자의 1차 질문("설치형/가입형")을 인기지표보다
                먼저 답한다. is_open_source가 truthy면 오픈소스, 그 외(undefined 포함)
                는 '독점'으로 폴백 — 라벨 항상 표시 불변식 유지. 색 단독 금지 →
                텍스트 + 점 문자(◆/◇) 2중 채널. title로 영문 풀네임 보강. */}
            <div className="meta-item">
              <span className="meta-label">라이선스</span>
              {tool.is_open_source ? (
                <span className="license-badge license-open" title="Open-Source">
                  <span className="license-dot" aria-hidden="true">◆</span>
                  오픈소스
                </span>
              ) : (
                <span className="license-badge license-proprietary" title="Proprietary">
                  <span className="license-dot" aria-hidden="true">◇</span>
                  독점
                </span>
              )}
            </div>

            {/* GitHub stars: 강조 지표로 승격되지 않은 경우에만 보조 메타로 표시.
                라벨 텍스트+아이콘+숫자로 의미를 전달한다(색만으로 의미 전달 금지). */}
            {headlineMetric?.kind !== 'stars' && starsValue && (
              <div className="meta-item">
                <span className="meta-label">GitHub</span>
                <span className="meta-value popularity-value">
                  <span className="popularity-icon" aria-hidden="true">★</span>
                  {starsValue}
                </span>
              </div>
            )}

            {headlineMetric?.kind !== 'users' && userCountValue && (
              <div className="meta-item">
                <span className="meta-label">사용자</span>
                <span className="meta-value">{userCountValue}</span>
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
                  {difficultyLabel(tool.difficulty)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* 매칭 근거 (추천 전용, 링크 바깥). 추천 맥락의 핵심 지표 = "왜 추천됐나" =
          매칭 강도. 일치 개수를 강조색·세미볼드로 승격(헤드라인급)하고, 구체 태그는
          보조 텍스트로 강등(정보 위계: 강도 > 태그 나열). 색 단독 금지 → 체크 아이콘
          + 숫자 + 텍스트 라벨 병행. */}
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
          <span className="match-reason-strength">
            태그 {reasonTags.length}개 일치
          </span>
          <span className="match-reason-tags">{reasonTags.join(' · ')}</span>
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
