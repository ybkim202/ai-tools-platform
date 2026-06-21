import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI } from '../services/api';
import { benchmarkTypeLabel, formatBenchmarkScore } from '../utils/benchmark';
import '../styles/Curated.css';

// 랜딩 성능 벤치마크 프리뷰 — 대표 벤치마크(행이 가장 많은 type)의 상위 3개 도구를
// 점수와 함께 보여주고 /benchmarks 로 잇는다(간단 미리보기 + CTA 세트).
// 벤치 데이터가 없으면 렌더하지 않는다(빈 섹션·거짓 신호 금지, 정직성 G3).
const TOP_N = 3;

const BenchmarkTeaser = () => {
  const [teaser, setTeaser] = useState(null); // { type, rows }

  useEffect(() => {
    let active = true;
    benchmarksAPI
      .getBenchmarks({ sort_by: 'score_desc', limit: 50 })
      .then((res) => {
        if (!active) return;
        const rows = res?.data?.data || [];
        if (rows.length === 0) {
          setTeaser(null);
          return;
        }
        // benchmark_type 별로 묶어 가장 많은 도구를 가진 type 을 대표로 선택
        // (가장 채워진 리더보드 = 가장 의미 있는 미리보기).
        const byType = new Map();
        rows.forEach((r) => {
          if (!byType.has(r.benchmark_type)) byType.set(r.benchmark_type, []);
          byType.get(r.benchmark_type).push(r);
        });
        let best = null;
        byType.forEach((list, type) => {
          if (!best || list.length > best.list.length) best = { type, list };
        });
        if (!best) {
          setTeaser(null);
          return;
        }
        // 같은 type 내에서 점수 내림차순(단위 동일 → 안전) 상위 N.
        const top = [...best.list]
          .sort((a, b) => Number(b.score) - Number(a.score))
          .slice(0, TOP_N);
        setTeaser({ type: best.type, rows: top });
      })
      .catch(() => {
        if (active) setTeaser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!teaser || teaser.rows.length === 0) return null;

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
      <p className="bench-teaser-sub">
        {benchmarkTypeLabel(teaser.type)} 기준 상위 {teaser.rows.length}개 도구
      </p>

      <ol className="bench-teaser-list">
        {teaser.rows.map((row, idx) => (
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
