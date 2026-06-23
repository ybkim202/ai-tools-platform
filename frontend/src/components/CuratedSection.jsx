import React from 'react';
import { Link } from 'react-router-dom';
import { formatUserCount, formatMetric } from '../utils/format';
import { resolveLogoSrc, handleLogoError } from '../utils/logoFallback';
import '../styles/Curated.css';

// 큐레이션 섹션(랜딩) — 한 카테고리의 인기 Top N 미니 카드 + "전체 보기".
// 핵심 지표 1개(인기) 승격: GitHub stars(오픈소스)→user_count. 성능은 보조 —
// 벤치마크 데이터가 있는 도구에만 '벤치' 칩(없는 곳에 만들지 않음, 정직성 G3).
const popularityMetric = (tool) => {
  const stars =
    tool.is_open_source === true ? formatMetric(tool.github_stars) : null;
  if (stars) return { icon: '★', value: stars, label: 'GitHub stars' };
  const users = formatUserCount(tool.user_count);
  if (users) return { icon: null, value: users, label: '사용자 수' };
  return null;
};

const CuratedSection = ({ category, tools, benchmarkIds }) => {
  if (!tools || tools.length === 0) return null;
  return (
    <section className="curated-section" aria-labelledby={`curated-${category}`}>
      <div className="curated-section-header">
        <h2 id={`curated-${category}`} className="curated-section-title">
          {category}
        </h2>
        {/* 이 카테고리 전체는 탐색으로 — 큐레이션은 Top N 만, 나머지는 /explore. */}
        <Link
          className="curated-see-all"
          to={`/explore?category=${encodeURIComponent(category)}`}
        >
          전체 보기
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <ol className="curated-grid">
        {tools.map((tool, idx) => {
          const metric = popularityMetric(tool);
          const hasBench = benchmarkIds?.has(tool.id);
          return (
            <li key={tool.id} className="curated-card">
              <Link to={`/details/${tool.id}`} className="curated-card-link">
                <span className="curated-rank" aria-hidden="true">
                  {idx + 1}
                </span>
                <img
                  src={resolveLogoSrc(tool.logo_url, tool.name, tool.official_url)}
                  alt=""
                  className="curated-logo"
                  loading="lazy"
                  data-official-url={tool.official_url || ''}
                  onError={handleLogoError}
                />
                <span className="curated-body">
                  <span className="curated-name">{tool.name}</span>
                  <span className="curated-meta">
                    {metric ? (
                      <span className="curated-metric">
                        {metric.icon && (
                          <span className="curated-metric-icon" aria-hidden="true">
                            {metric.icon}
                          </span>
                        )}
                        {metric.value}
                        <span className="sr-only"> {metric.label}</span>
                      </span>
                    ) : (
                      <span className="curated-metric curated-metric--empty">-</span>
                    )}
                    {/* 성능 보조: 벤치 데이터가 있을 때만 노출(색 단독 금지 — 텍스트 칩). */}
                    {hasBench && (
                      <span className="curated-bench-chip">벤치</span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

export default CuratedSection;
