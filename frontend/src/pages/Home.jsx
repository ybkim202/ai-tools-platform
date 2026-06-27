import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI, benchmarksAPI, handleApiError } from '../services/api';
import CuratedHeroWidget from '../components/CuratedHeroWidget';
import BenchmarkTeaser from '../components/BenchmarkTeaser';
import RecommendationPanel from '../components/RecommendationPanel';
import { LoadingState, ErrorState } from '../components/states/StateViews';
import '../styles/Home.css';

// 랜딩(/). IA 재설계 §9 — 큐레이션 우선: 전체 111개 그리드를 노출하던 첫 화면을
// "카테고리별 인기 Top N 엄선"으로 바꾼다. 전체 탐색은 /explore 로 이동(ToolBrowser).
// 큐레이션 기준 = 인기 기본 + 성능 보조(벤치 데이터 있는 도구에만 칩).
const FEATURED_CATEGORIES = 6; // 첫 화면에 노출할 카테고리 수(나머지는 /explore).
const TOP_PER_CATEGORY = 5;

const Home = () => {
  const [totalTools, setTotalTools] = useState(0);
  const [sections, setSections] = useState([]); // [{ category, tools }]
  const [benchmarkIds, setBenchmarkIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLanding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 인기순 상위 100개(서버 limit 상한) + 메타 + 벤치 커버리지를 병렬 적재.
      // 상위 카테고리(도구 多)의 Top 5 는 전부 이 100개 안에 들어온다.
      const [toolsRes, metaRes, benchRes] = await Promise.all([
        toolsAPI.getTools({ sort_by: 'popularity', limit: 100 }),
        toolsAPI.getMeta(),
        benchmarksAPI.getBenchmarks({ limit: 100 }).catch(() => null),
      ]);

      const tools = toolsRes.data?.data || [];
      const meta = metaRes.data?.data || {};

      if (Number.isFinite(Number(meta.total_tools))) {
        setTotalTools(Number(meta.total_tools));
      }

      // 벤치마크 보유 tool_id 집합(성능 보조 칩 근거).
      const benchRows = benchRes?.data?.data || [];
      setBenchmarkIds(new Set(benchRows.map((r) => r.tool_id)));

      // 카테고리별 버킷(인기순 유지) → 도구 수 많은 순으로 상위 N 카테고리 선정.
      const buckets = new Map();
      tools.forEach((t) => {
        if (!t.category) return;
        if (!buckets.has(t.category)) buckets.set(t.category, []);
        buckets.get(t.category).push(t);
      });
      const ordered = Array.from(buckets.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, FEATURED_CATEGORIES)
        .map(([category, list]) => ({
          category,
          tools: list.slice(0, TOP_PER_CATEGORY),
        }));
      setSections(ordered);
    } catch (err) {
      setError(handleApiError(err));
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLanding();
  }, [fetchLanding]);

  return (
    <div className="home">
      {/* Hero 2단 — 좌: 문구·CTA(좌측정렬), 우: 큐레이션 위젯(좌 카테고리/우 툴 리스트).
          배경(그라디언트+도트패턴)은 전체폭, 콘텐츠는 컬럼 그리드(1200) 폭으로 제한. */}
      <section className="hero hero--split">
        <div className="hero-gradient"></div>
        <div className="hero-bg-pattern" aria-hidden="true"></div>
        <div className="hero-split-inner">
        <div className="hero-content">
          <div className="hero-badge">
            {totalTools > 0
              ? `AI 도구 ${totalTools}개 · 매주 갱신`
              : '매주 갱신되는 AI 도구 큐레이션'}
          </div>
          <h1 className="hero-title">
            지금 주목할 AI 도구를<br />엄선해 보여드립니다
          </h1>
          <p className="hero-subtitle">
            용도별로 가장 인기 있는 도구를 먼저 만나고, 필요하면 전체를 탐색하세요
          </p>
          <div className="hero-cta-group">
            <Link to="/explore" className="cta-button">
              모든 도구 탐색
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 10h12m0 0l-4-4m4 4l-4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <Link to="/trends/github" className="cta-button cta-button-secondary">
              지금 뜨는 AI 보기
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 17l6-6 4 4 7-7m0 0h-5m5 0v5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* 우측: 카테고리별 인기 Top N 큐레이션 위젯 */}
        <div className="hero-curated">
          {loading ? (
            <LoadingState message="추천 도구를 불러오는 중..." />
          ) : error ? (
            <ErrorState
              message={error?.message}
              errorId={error?.errorId}
              onRetry={fetchLanding}
            />
          ) : (
            <CuratedHeroWidget sections={sections} benchmarkIds={benchmarkIds} />
          )}
        </div>
        </div>
      </section>

      {/* 맞춤 추천 — 직무/업무 기반(독립 페이지 은퇴, 랜딩 임베드). Hero 다음 배치. */}
      <RecommendationPanel />

      {/* 성능 벤치마크 프리뷰 + CTA — 대표 벤치마크 상위 도구를 맛보기로(데이터 없으면 미렌더). */}
      <BenchmarkTeaser />

      {/* Footer CTA — 단일 CTA로 마무리(전체 탐색 유도). */}
      <section className="footer-cta">
        <div className="container">
          <h2>당신에게 맞는 AI 도구를 찾아보세요</h2>
          <p>카테고리·인기·성능으로 한눈에 비교하고 바로 선택하세요</p>
          <div className="cta-buttons">
            <Link to="/explore" className="btn btn-primary">
              모든 도구 탐색
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
