import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatUserCount, formatMetric } from '../utils/format';
import { resolveLogoSrc, handleLogoError } from '../utils/logoFallback';
import '../styles/Curated.css';

// 카테고리 아이콘 — 무채색 라인 아이콘(currentColor). 이모지 대신 SVG로 잉크 톤 일치.
// 키는 실제 DB 카테고리(한글). 매핑 없으면 기본 아이콘(별 스파클).
const ICON_PATHS = {
  개발도구: 'M8 6l-5 6 5 6M16 6l5 6-5 6', // </> 코드 브래킷
  생성형AI: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3L12 3z', // 스파클
  AI플랫폼: 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4', // 레이어
  생산성: 'M13 3L4 14h7l-1 7 9-11h-7l1-7z', // 번개(효율)
  콘텐츠생성: 'M14 3v5h5M14 3l5 5v11a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1h8z', // 문서
  쓰기보조: 'M3 21l3-1 11-11-2-2L4 18l-1 3zM14 7l2 2', // 펜
  이미지생성:
    'M3 5h18v14H3V5zm0 11l5-5 4 4 3-3 6 6M9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z', // 이미지
  이미지편집:
    'M3 5h18v14H3V5zm0 11l5-5 4 4 3-3 6 6M9 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
  디자인: 'M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.5 0-1 .8-1.5 1.5-1.5h1a3 3 0 003-3 7 7 0 00-7-9zM7 12a1 1 0 100-2 1 1 0 000 2zm4-4a1 1 0 100-2 1 1 0 000 2z', // 팔레트
  데이터분석: 'M4 20V10M10 20V4M16 20v-7M20 20H3', // 막대 차트
  데이터서비스: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6', // DB 실린더
  컴퓨터비전:
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zm10 3a3 3 0 100-6 3 3 0 000 6z', // 눈
  음성생성: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3', // 마이크
  음성처리: 'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM5 11a7 7 0 0014 0M12 18v3',
  오디오편집: 'M4 12h2l2-6 4 14 3-9 2 1h3', // 파형
  비디오생성: 'M3 5h13v14H3V5zm13 5l5-3v10l-5-3', // 비디오
  엔터테인먼트: 'M8 5v14l11-7L8 5z', // 재생
  검색AI: 'M11 4a7 7 0 105.2 11.7L21 20M11 4a7 7 0 010 14', // 검색
  API: 'M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3M9 12h6', // 플러그/포트
  특수목적: 'M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 16l-4.9 2.6.9-5.5-4-3.9 5.5-.8L12 3z', // 별
};
const FALLBACK_ICON = ICON_PATHS.특수목적;

const CategoryIcon = ({ category }) => (
  <svg
    className="curated-hero-cat-icon"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={ICON_PATHS[category] || FALLBACK_ICON} />
  </svg>
);

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
                <CategoryIcon category={sec.category} />
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
