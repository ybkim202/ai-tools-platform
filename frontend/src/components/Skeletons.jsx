import React from 'react';
import '../styles/Skeleton.css';
import '../styles/Curated.css';
import '../styles/Recommendations.css';

// 스켈레톤 블록 — 임의 크기의 wave 플레이스홀더(장식이라 aria-hidden).
const Block = ({ w, h, r, className = '' }) => (
  <span
    className={`skeleton ${className}`}
    style={{ width: w, height: h, borderRadius: r }}
    aria-hidden="true"
  />
);

const times = (n) => Array.from({ length: n });

// 1) Hero 큐레이션 위젯 스켈레톤 — 좌 아이콘 레일 + 우 Top5 리스트(실제 레이아웃 재사용).
export const CuratedHeroSkeleton = () => (
  <div
    className="curated-hero"
    role="status"
    aria-busy="true"
    aria-label="추천 도구 불러오는 중"
  >
    <div className="curated-hero-split">
      <div className="curated-hero-cats">
        {times(6).map((_, i) => (
          <Block key={i} w="44px" h="44px" r="var(--radius-md)" />
        ))}
      </div>
      <div className="curated-hero-list">
        <div className="curated-hero-list-head">
          <Block w="120px" h="20px" />
          <Block w="64px" h="14px" />
        </div>
        <ol className="curated-hero-tools">
          {times(5).map((_, i) => (
            <li key={i} className="curated-hero-tool">
              <div className="curated-hero-tool-link">
                <Block w="1em" h="1em" />
                <Block w="32px" h="32px" r="var(--radius-md)" />
                <span className="curated-tool-skel-body">
                  <Block w="55%" h="12px" />
                  <Block w="35%" h="10px" />
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
    <span className="sr-only">불러오는 중…</span>
  </div>
);

// 2) 맞춤 추천 — 칩 줄 스켈레톤(옵션 로딩).
export const RecommendChipsSkeleton = () => (
  <div
    className="option-chips"
    role="status"
    aria-busy="true"
    aria-label="선택지 불러오는 중"
  >
    {[92, 72, 108, 64, 84, 100, 76].map((w, i) => (
      <Block key={i} w={`${w}px`} h="30px" r="var(--radius-full)" />
    ))}
    <span className="sr-only">불러오는 중…</span>
  </div>
);

// 3) 맞춤 추천 — 결과 카드 스켈레톤(카루셀 4개).
export const RecommendCardsSkeleton = () => (
  <div
    className="rec-carousel"
    role="status"
    aria-busy="true"
    aria-label="추천 불러오는 중"
    style={{ overflow: 'hidden' }}
  >
    {times(4).map((_, i) => (
      <div key={i} className="rec-carousel-item">
        <div className="rec-card-skel">
          <div className="rec-card-skel-head">
            <Block w="40px" h="40px" r="var(--radius-md)" />
            <Block w="55%" h="16px" />
          </div>
          <div className="rec-card-skel-lines">
            <Block w="100%" h="12px" />
            <Block w="90%" h="12px" />
            <Block w="70%" h="12px" />
          </div>
          <Block w="45%" h="14px" />
          <div className="rec-card-skel-foot">
            <Block w="100%" h="40px" r="var(--radius-md)" />
            <Block w="72px" h="40px" r="var(--radius-md)" />
          </div>
        </div>
      </div>
    ))}
    <span className="sr-only">불러오는 중…</span>
  </div>
);

// 4) 깃헙 트렌드 — 벤토 스켈레톤(히어로 2×2 + 셀 4개).
export const TrendBentoSkeleton = () => (
  <div
    className="bento-grid"
    role="status"
    aria-busy="true"
    aria-label="깃헙 트렌드 불러오는 중"
  >
    <div className="bento-cell bento-hero bento-skel">
      <div className="bento-skel-lines">
        <Block w="45%" h="14px" />
        <Block w="70%" h="28px" />
        <Block w="100%" h="12px" />
        <Block w="92%" h="12px" />
        <Block w="80%" h="12px" />
      </div>
      <div className="bento-skel-foot">
        <Block w="40%" h="14px" />
      </div>
    </div>
    {times(4).map((_, i) => (
      <div key={i} className="bento-cell bento-skel">
        <div className="bento-skel-lines">
          <Block w="60%" h="12px" />
          <Block w="80%" h="18px" />
          <Block w="45%" h="12px" />
        </div>
      </div>
    ))}
    <span className="sr-only">불러오는 중…</span>
  </div>
);

// 5) 성능 벤치마크 — 좌 탭 + 우 막대 스켈레톤.
export const BenchTeaserSkeleton = () => (
  <div
    className="bench-teaser-split"
    role="status"
    aria-busy="true"
    aria-label="벤치마크 불러오는 중"
  >
    <div className="bench-teaser-criteria">
      {times(5).map((_, i) => (
        <span
          key={i}
          className="bench-teaser-crit"
          style={{ display: 'block', cursor: 'default' }}
        >
          <Block w="70%" h="12px" />
          <Block w="40%" h="10px" r="var(--radius-sm)" />
        </span>
      ))}
    </div>
    <div className="bench-teaser-graph">
      <Block w="160px" h="16px" />
      <ul className="bench-bars" style={{ marginTop: 'var(--spacing-md)' }}>
        {[92, 78, 66, 54, 44].map((w, i) => (
          <li key={i} className="bench-bar-row">
            <Block w="80px" h="14px" />
            <Block w={`${w}%`} h="12px" r="var(--radius-full)" />
            <Block w="40px" h="14px" />
          </li>
        ))}
      </ul>
    </div>
    <span className="sr-only">불러오는 중…</span>
  </div>
);
