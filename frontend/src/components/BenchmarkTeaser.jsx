import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI } from '../services/api';
import { benchmarkTypeLabel, formatBenchmarkScore } from '../utils/benchmark';
import '../styles/Curated.css';

// 랜딩 성능 벤치마크 프리뷰 — 2단 대시보드: 좌(벤치마크 기준 목록) / 우(가로 막대
// 그래프). 기준을 고르면 우측 그래프가 그 리더보드로 바뀐다. 도구 2개 이상인 type 만
// (1개짜리 리더보드 제외), 도구 많은 순·최대 6개. 데이터 없으면 미렌더(정직성 G3).
const TOP_N = 5;
const MIN_TOOLS = 2;
const MAX_CRITERIA = 6;

// 막대 길이(%) — Benchmarks 페이지와 동일 규칙: percent→만점(100) 분모, elo→축
// 최고점 분모(절대 만점 없음). 점수 있는 막대는 6% floor 로 0 과 구분.
const barPct = (score, unit, axisMax, maxScore) => {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  const denom =
    unit === 'elo'
      ? axisMax
      : Number(maxScore) > 0
      ? Number(maxScore)
      : 100;
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return Math.max(6, Math.min(100, (n / denom) * 100));
};

const BenchmarkTeaser = () => {
  const [groups, setGroups] = useState([]); // [{ type, count, rows(top N) }]
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
          .sort((a, b) => b[1].length - a[1].length)
          .slice(0, MAX_CRITERIA)
          .map(([type, list]) => ({
            type,
            count: list.length,
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

  const unit = current.rows[0]?.unit || 'percent';
  const axisMax = Math.max(...current.rows.map((r) => Number(r.score) || 0));
  const unitHint = unit === 'elo' ? 'Elo · 상대 점수' : '100점 만점';

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

      <div className="bench-teaser-split">
        {/* 좌: 벤치마크 기준 목록(세로 탭) */}
        <div
          className="bench-teaser-criteria"
          role="tablist"
          aria-orientation="vertical"
          aria-label="벤치마크 선택"
        >
          {groups.map((g) => {
            const selected = g.type === current.type;
            return (
              <button
                key={g.type}
                type="button"
                role="tab"
                id={`bench-crit-${g.type}`}
                aria-selected={selected}
                aria-controls="bench-teaser-graph"
                className={`bench-teaser-crit${selected ? ' active' : ''}`}
                onClick={() => setActive(g.type)}
              >
                <span className="bench-crit-name">
                  {benchmarkTypeLabel(g.type)}
                </span>
                <span className="bench-crit-meta">{g.count}개 모델</span>
              </button>
            );
          })}
        </div>

        {/* 우: 가로 막대 그래프 */}
        <div
          className="bench-teaser-graph"
          id="bench-teaser-graph"
          role="tabpanel"
          aria-labelledby={`bench-crit-${current.type}`}
        >
          <p className="bench-graph-head">
            <span className="bench-graph-title">
              {benchmarkTypeLabel(current.type)}
            </span>
            <span className="bench-graph-unit">{unitHint}</span>
          </p>
          <ul className="bench-bars" aria-live="polite">
            {current.rows.map((row, idx) => (
              <li key={row.id} className="bench-bar-row">
                <Link
                  to={`/details/${row.tool_id}`}
                  className="bench-bar-name"
                >
                  <span className="bench-bar-rank" aria-hidden="true">
                    {idx + 1}
                  </span>
                  {row.tool_name}
                </Link>
                <div className="bench-bar-track" aria-hidden="true">
                  <div
                    className={`bench-bar-fill${idx === 0 ? ' is-top' : ''}`}
                    style={{
                      width: `${barPct(row.score, unit, axisMax, row.max_score)}%`,
                    }}
                  />
                </div>
                <span className="bench-bar-score">
                  {formatBenchmarkScore(row)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default BenchmarkTeaser;
