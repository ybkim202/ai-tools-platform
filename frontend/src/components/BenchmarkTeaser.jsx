import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI } from '../services/api';
import { benchmarkTypeLabel } from '../utils/benchmark';
import { resolveLogoSrc, handleLogoError } from '../utils/logoFallback';
import '../styles/Curated.css';

// 랜딩 성능 벤치마크 프리뷰 — Apple 벤토(Bento) 그리드. 탭 없이 여러 벤치를 한눈에:
// 큰 히어로 셀(모델 多 벤치의 Top 3 미니 리더보드) + 작은 지표 셀(각 벤치 1위 + 큰 점수).
// 도구 2개 이상인 type 만(1개짜리 제외), 도구 많은 순, 최대 5개(히어로+4). 데이터 없으면 미렌더(G3).
const MIN_TOOLS = 2;
const MAX_CRITERIA = 5;
const HERO_TOP = 3;

// 히어로 미니바 길이(%). percent→만점 분모, elo→그룹 최고점 분모. 6% floor 로 0 구분.
const barPct = (score, unit, axisMax, maxScore) => {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  const denom =
    unit === 'elo' ? axisMax : Number(maxScore) > 0 ? Number(maxScore) : 100;
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  return Math.max(6, Math.min(100, (n / denom) * 100));
};

// 점수를 큰 숫자 + 맥락으로 분리(벤토 셀의 헤드라인 지표). elo→"Elo", 그 외→"/ 만점".
const scoreParts = (row) => {
  const n = Number(row.score);
  if (!Number.isFinite(n)) return { value: '-', ctx: '' };
  const value = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  if ((row.unit || '') === 'elo') return { value, ctx: 'Elo' };
  const max = Number(row.max_score) > 0 ? Number(row.max_score) : 100;
  return { value, ctx: `/ ${max}` };
};

const unitHintOf = (row) =>
  (row?.unit || '') === 'elo' ? 'Elo · 상대 점수' : '100점 만점';

// 벤토 지표 셀(각 벤치의 1위 모델 + 큰 점수).
const BentoMetricCell = ({ group }) => {
  const top = group.rows[0];
  const { value, ctx } = scoreParts(top);
  return (
    <article className="bento-cell bento-metric">
      <span className="bento-eyebrow">{benchmarkTypeLabel(group.type)}</span>
      <Link to={`/details/${top.tool_id}`} className="bento-lead">
        <img
          src={resolveLogoSrc(top.logo_url, top.tool_name, top.official_url)}
          alt=""
          className="bento-logo"
          loading="lazy"
          data-official-url={top.official_url || ''}
          onError={handleLogoError}
        />
        <span className="bento-lead-name">{top.tool_name}</span>
      </Link>
      <span className="bento-score">
        <b className="bento-score-val">{value}</b>
        <span className="bento-score-ctx">{ctx}</span>
      </span>
      <span className="bento-meta">
        {benchmarkTypeLabel(group.type)} 1위 · {group.count}개 모델
      </span>
    </article>
  );
};

const BenchmarkTeaser = () => {
  const [groups, setGroups] = useState([]); // [{ type, count, rows(top N) }]

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
            rows: [...list].sort((a, b) => Number(b.score) - Number(a.score)),
          }));
        setGroups(built);
      })
      .catch(() => {
        if (alive) setGroups([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (groups.length === 0) return null;

  const hero = groups[0];
  const rest = groups.slice(1);
  const heroTop = hero.rows.slice(0, HERO_TOP);
  const heroUnit = hero.rows[0]?.unit || 'percent';
  const heroAxisMax = Math.max(...hero.rows.map((r) => Number(r.score) || 0));

  return (
    <section className="bench-teaser" aria-labelledby="bench-teaser-title">
      <div className="curated-section-header">
        <div className="curated-section-heading">
          <h2 id="bench-teaser-title" className="curated-section-title">
            성능 벤치마크
          </h2>
          <p className="curated-section-subtitle">
            주요 모델을 같은 기준으로 평가한 성능 점수
          </p>
        </div>
        <Link className="curated-see-all" to="/benchmarks">
          벤치마크 전체 보기
          <span aria-hidden="true"> →</span>
        </Link>
      </div>

      <div className="bento-grid">
        {/* 히어로 셀 — 모델이 가장 많은 벤치의 Top 3 미니 리더보드(2×2). */}
        <article className="bento-cell bento-hero">
          <div className="bento-head">
            <span className="bento-eyebrow">{benchmarkTypeLabel(hero.type)}</span>
            <span className="bento-hint">
              {unitHintOf(hero.rows[0])} · {hero.count}개 모델
            </span>
          </div>
          <ol className="bento-rank">
            {heroTop.map((row, idx) => {
              const { value, ctx } = scoreParts(row);
              return (
                <li
                  key={row.id}
                  className={`bento-rank-row${idx === 0 ? ' is-top' : ''}`}
                >
                  <Link to={`/details/${row.tool_id}`} className="bento-rank-link">
                    <span className="bento-rank-num" aria-hidden="true">
                      {idx + 1}
                    </span>
                    <img
                      src={resolveLogoSrc(row.logo_url, row.tool_name, row.official_url)}
                      alt=""
                      className="bento-logo"
                      loading="lazy"
                      data-official-url={row.official_url || ''}
                      onError={handleLogoError}
                    />
                    <span className="bento-rank-name">{row.tool_name}</span>
                    <span className="bento-rank-score">
                      <b>{value}</b>
                      <span className="bento-score-ctx">{ctx}</span>
                    </span>
                  </Link>
                  <div className="bento-rank-bar" aria-hidden="true">
                    <div
                      className={`bento-rank-fill${idx === 0 ? ' is-top' : ''}`}
                      style={{
                        width: `${barPct(row.score, heroUnit, heroAxisMax, row.max_score)}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </article>

        {/* 나머지 벤치 — 각 1위 모델 + 큰 점수(1×1). */}
        {rest.map((g) => (
          <BentoMetricCell key={g.type} group={g} />
        ))}
      </div>
    </section>
  );
};

export default BenchmarkTeaser;
