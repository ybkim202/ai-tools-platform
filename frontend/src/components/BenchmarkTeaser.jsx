import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI } from '../services/api';
import { benchmarkTypeLabel, formatBenchmarkScore } from '../utils/benchmark';
import '../styles/Curated.css';

// 랜딩 성능 벤치마크 프리뷰(인터랙티브) — 여러 벤치마크를 탭으로 전환하며 상위 도구
// 리더보드를 둘러본다 + /benchmarks CTA. 도구 2개 이상인 type 만 탭으로 노출(1개짜리
// 리더보드는 무의미). 데이터 없으면 렌더하지 않음(빈 섹션·거짓 신호 금지, 정직성 G3).
const TOP_N = 3;
const MIN_TOOLS = 2; // 리더보드 성립 최소 도구 수
const MAX_TABS = 5;

const BenchmarkTeaser = () => {
  const [groups, setGroups] = useState([]); // [{ type, rows(top N) }]
  const [active, setActive] = useState(null);

  useEffect(() => {
    let alive = true;
    benchmarksAPI
      .getBenchmarks({ sort_by: 'score_desc', limit: 100 })
      .then((res) => {
        if (!alive) return;
        const rows = res?.data?.data || [];
        const byType = new Map();
        rows.forEach((r) => {
          if (!byType.has(r.benchmark_type)) byType.set(r.benchmark_type, []);
          byType.get(r.benchmark_type).push(r);
        });
        const built = Array.from(byType.entries())
          .filter(([, list]) => list.length >= MIN_TOOLS)
          .sort((a, b) => b[1].length - a[1].length) // 도구 많은 벤치 먼저
          .slice(0, MAX_TABS)
          .map(([type, list]) => ({
            type,
            rows: [...list]
              .sort((a, b) => Number(b.score) - Number(a.score))
              .slice(0, TOP_N),
          }));
        setGroups(built);
        setActive(built.length > 0 ? built[0].type : null);
      })
      .catch(() => {
        if (alive) setGroups([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const current = useMemo(
    () => groups.find((g) => g.type === active) || groups[0] || null,
    [groups, active]
  );

  if (!current) return null;

  return (
    <section className="bench-teaser" aria-labelledby="bench-teaser-title">
      <div className="curated-section-header">
        <h2 id="bench-teaser-title" className="curated-section-title">
          성능 벤치마크
        </h2>
        <Link className="curated-see-all" to="/benchmarks">
          벤치마크 전체 보기
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      {/* 벤치마크 토글 — 탭으로 다른 리더보드 전환(둘러보는 재미). */}
      <div
        className="bench-teaser-tabs"
        role="tablist"
        aria-label="벤치마크 선택"
      >
        {groups.map((g) => {
          const selected = g.type === current.type;
          return (
            <button
              key={g.type}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`bench-teaser-tab${selected ? ' active' : ''}`}
              onClick={() => setActive(g.type)}
            >
              {benchmarkTypeLabel(g.type)}
            </button>
          );
        })}
      </div>

      <ol className="bench-teaser-list" aria-live="polite">
        {current.rows.map((row, idx) => (
          <li key={row.id} className="bench-teaser-item">
            <Link to={`/details/${row.tool_id}`} className="bench-teaser-link">
              <span className="bench-teaser-rank" aria-hidden="true">
                {idx + 1}
              </span>
              <span className="bench-teaser-name">{row.tool_name}</span>
              <span className="bench-teaser-score">
                {formatBenchmarkScore(row)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default BenchmarkTeaser;
