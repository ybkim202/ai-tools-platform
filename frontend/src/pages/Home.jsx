import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI, benchmarksAPI, handleApiError } from '../services/api';
import CuratedSection from '../components/CuratedSection';
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
  const [tasks, setTasks] = useState([]);
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
      if (Array.isArray(meta.tasks)) setTasks(meta.tasks);

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
      {/* Hero — 간결한 가치 + 1차 진입(전체 탐색). 큐레이션이 본문이라 hero는 가볍게. */}
      <section className="hero">
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
        <div className="hero-gradient"></div>
      </section>

      {/* 용도로 바로 찾기 — task(직무/용도) 우선 진입. 카테고리(도구 종류)와 다른 축. */}
      {tasks.length > 0 && (
        <section className="task-quicknav" aria-label="용도로 바로 찾기">
          <div className="container task-quicknav-inner">
            <span className="task-quicknav-label">용도로 바로 찾기</span>
            <ul className="task-quicknav-list">
              {tasks.slice(0, 8).map((task) => (
                <li key={task}>
                  <Link
                    className="task-quicknav-chip"
                    to={`/?type=task&value=${encodeURIComponent(task)}#recommend`}
                  >
                    {task}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* 큐레이션 본문 — 카테고리별 인기 Top N */}
      <div className="curated-wrap">
        {loading ? (
          <LoadingState message="추천 도구를 불러오는 중..." />
        ) : error ? (
          <ErrorState
            message={error?.message}
            errorId={error?.errorId}
            onRetry={fetchLanding}
          />
        ) : (
          <>
            {sections.map((sec) => (
              <CuratedSection
                key={sec.category}
                category={sec.category}
                tools={sec.tools}
                benchmarkIds={benchmarkIds}
              />
            ))}

            {/* 전체 탐색 유도 — 큐레이션은 일부, 전부는 여기서. */}
            <section className="explore-cta">
              <div className="container">
                <p className="explore-cta-text">
                  {totalTools > 0
                    ? `전체 ${totalTools}개 도구를 검색·필터로 직접 살펴보세요`
                    : '전체 도구를 검색·필터로 직접 살펴보세요'}
                </p>
                <Link to="/explore" className="btn btn-primary">
                  전체 도구 탐색하기
                </Link>
              </div>
            </section>
          </>
        )}
      </div>

      {/* 맞춤 추천 — 직무/업무 기반(독립 페이지 은퇴, 랜딩 임베드). */}
      <RecommendationPanel />

      {/* Footer CTA — 비교/추천 경로 유지. */}
      <section className="footer-cta">
        <div className="container">
          <h2>AI는 매주 바뀝니다. 계속 따라잡으세요</h2>
          <p>지금 뜨는 도구, 벤치마크, 맞춤 추천까지 한곳에서 확인하세요</p>
          <div className="cta-buttons">
            <Link to="/compare" className="btn btn-primary">
              도구 비교
            </Link>
            <a href="#recommend" className="btn btn-secondary">
              맞춤 추천
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
