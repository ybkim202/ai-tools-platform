import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatUserCount, formatMetric } from '../utils/format';
import { resolveLogoSrc, handleLogoError } from '../utils/logoFallback';
import '../styles/Curated.css';

// 핵심 지표 1개(인기) — 오픈소스는 GitHub stars, 그 외 user_count. 둘 다 없으면 null.
const popularityMetric = (tool) => {
  const stars =
    tool.is_open_source === true ? formatMetric(tool.github_stars) : null;
  if (stars) return { icon: '★', value: stars, label: 'GitHub stars' };
  const users = formatUserCount(tool.user_count);
  if (users) return { icon: null, value: users, label: '사용자 수' };
  return null;
};

// Hero 큐레이션 위젯 — 벤치마크 프리뷰처럼 좌측 카테고리(세로 탭) / 우측 그 카테고리의
// 인기 Top N 툴 세로 리스트. 카테고리를 고르면 우측 리스트가 바뀐다.
const CuratedHeroWidget = ({ sections, benchmarkIds }) => {
  const [active, setActive] = useState(sections[0]?.category || null);
  const current = useMemo(
    () => sections.find((s) => s.category === active) || sections[0] || null,
    [sections, active]
  );
  if (!current) return null;

  return (
    <div className="curated-hero">
      <div className="curated-hero-split">
        {/* 좌: 카테고리 세로 탭 */}
        <div
          className="curated-hero-cats"
          role="tablist"
          aria-orientation="vertical"
          aria-label="카테고리"
        >
          {sections.map((sec) => {
            const selected = sec.category === current.category;
            return (
              <button
                key={sec.category}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`curated-hero-cat${selected ? ' active' : ''}`}
                onClick={() => setActive(sec.category)}
              >
                <span className="curated-hero-cat-name">{sec.category}</span>
                <span className="curated-hero-cat-count">{sec.tools.length}</span>
              </button>
            );
          })}
        </div>

        {/* 우: 선택 카테고리의 인기 툴 세로 리스트 */}
        <div className="curated-hero-list" role="tabpanel">
          <div className="curated-hero-list-head">
            <h3 className="curated-hero-list-title">{current.category}</h3>
            <Link
              className="curated-see-all"
              to={`/explore?category=${encodeURIComponent(current.category)}`}
            >
              전체 보기
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
          <ol className="curated-hero-tools">
            {current.tools.map((tool, idx) => {
              const metric = popularityMetric(tool);
              const hasBench = benchmarkIds?.has(tool.id);
              return (
                <li key={tool.id} className="curated-hero-tool">
                  <Link
                    to={`/details/${tool.id}`}
                    className="curated-hero-tool-link"
                  >
                    <span className="curated-rank" aria-hidden="true">
                      {idx + 1}
                    </span>
                    <img
                      src={resolveLogoSrc(
                        tool.logo_url,
                        tool.name,
                        tool.official_url
                      )}
                      alt=""
                      className="curated-logo"
                      loading="lazy"
                      onError={handleLogoError}
                    />
                    <span className="curated-hero-tool-body">
                      <span className="curated-name">{tool.name}</span>
                      <span className="curated-meta">
                        {metric ? (
                          <span className="curated-metric">
                            {metric.icon && (
                              <span
                                className="curated-metric-icon"
                                aria-hidden="true"
                              >
                                {metric.icon}
                              </span>
                            )}
                            {metric.value}
                            <span className="sr-only"> {metric.label}</span>
                          </span>
                        ) : (
                          <span className="curated-metric curated-metric--empty">
                            -
                          </span>
                        )}
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
        </div>
      </div>
    </div>
  );
};

export default CuratedHeroWidget;
