import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { benchmarksAPI, handleApiError } from '../services/api';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/Benchmarks.css';

/*
 * 섹션(카테고리) 목록의 정본은 DB 다(GET /benchmarks/categories). 프론트는 표시
 * 카피(라벨/영문/설명)만 category 키로 join 해 보강한다 — 분류·존재 여부는 전부
 * DB 가 결정한다(헌법 G5/G6: 목록 하드코딩 금지). 코드에 카피가 없는 DB category 는
 * 폴백 라벨(category 원문)로 렌더해 누락 0, 코드에만 있고 DB 에 없는 카테고리는
 * 섹션을 만들지 않는다.
 *
 * 각 카테고리는 동일 unit 축만 포함한다(스펙 R4: 단위 혼합 금지).
 */
// 카테고리 표시 카피(메타). key 는 백엔드 benchmarks.category 값과 1:1 일치한다.
// 이 객체는 "분류"가 아니라 "표현 카피"만 보유한다 — 섹션 생성은 DB 응답으로 구동.
const CATEGORY_META = {
  추론: {
    labelEn: 'Reasoning',
    desc: '대학원 수준 과학·지식 추론(GPQA Diamond·MMLU-Pro)',
  },
  코딩: {
    labelEn: 'Coding',
    desc: '실전 코드 수정·생성 정확도(SWE-bench Verified·LiveCodeBench)',
  },
  수학: {
    labelEn: 'Math',
    desc: '경시·다단계 수학 문제 해결(AIME 2025·MATH-500)',
  },
  멀티모달: {
    labelEn: 'Multimodal',
    desc: '이미지와 텍스트를 결합한 추론(MMMU)',
  },
  선호: {
    labelEn: 'Preference',
    desc: '사람 선호 기반 상대 평가(LMArena Elo)',
  },
};

const MAX_COMPARE = 5;

// raw 점수 + 단위 포맷(스펙 C4·발견 #9 만점 표기).
//   percent → "92.0/100"(만점 100 명시), elo → 정수 Elo(절대 만점 없음).
const formatScore = (score, unit) => {
  if (!Number.isFinite(score)) return '-';
  if (unit === 'elo') return `${Math.round(score)} Elo`;
  return `${score.toFixed(1)}/100`;
};

// snapshot 날짜 → 'YYYY-MM' 표기. 없으면 null.
const formatSnapshot = (dateStr) => {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

// 막대 길이 정규화(발견 #7: 섹션·다축 두 뷰 동일 기준 — "0 기준 절대 비율").
//   percent → 만점 100 고정 분모(unit=percent 면 만점 100 으로 간주).
//   elo     → 절대 만점이 없으므로 축(섹션) 내 최댓값을 분모로(0 기준 유지).
// 어느 뷰든 같은 점수는 같은 길이로 그려진다(상대 min-max 제거). 점수 있는 셀은
// 시각 최소폭 8% floor 로 0 과 구분.
const barPct = (score, unit, axisMax) => {
  if (!Number.isFinite(score)) return 0;
  const denom = unit === 'elo' ? axisMax : 100;
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  const norm = Math.min(1, score / denom);
  return Math.max(8, norm * 100);
};

// 도구의 카테고리 내 최신 model_version 1개만 노출(스펙 Q2 권고).
// 같은 tool_id가 여러 type에 걸쳐 있으면 최고 점수 1행만 남긴다(snapshot 최신 우선).
const dedupeByTool = (list) => {
  const byTool = new Map();
  list.forEach((row) => {
    const prev = byTool.get(row.tool_id);
    if (!prev) {
      byTool.set(row.tool_id, row);
      return;
    }
    const prevDate = prev.collected_date || '';
    const curDate = row.collected_date || '';
    if (curDate > prevDate || (curDate === prevDate && row.score > prev.score)) {
      byTool.set(row.tool_id, row);
    }
  });
  return Array.from(byTool.values()).sort((a, b) => b.score - a.score);
};

const Benchmarks = () => {
  // 섹션 목록의 정본은 DB(/benchmarks/categories). 점수 행은 /benchmarks 1회 적재.
  const [categories, setCategories] = useState([]);
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 비교 트레이: 선택 도구(최대 5). { tool_id, tool_name } 보관.
  const [selected, setSelected] = useState([]);

  // 다축 패널 표시 여부 + 뷰 모드('bars' | 'radar').
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState('bars');

  // 활성 앵커 섹션(IntersectionObserver 동기화). 첫 DB 카테고리로 초기화.
  const [activeKey, setActiveKey] = useState(null);

  const panelRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 섹션 목록(DB 정본) + 점수 행을 병렬 적재.
      const [catRes, rowRes] = await Promise.all([
        benchmarksAPI.getBenchmarkCategories(),
        benchmarksAPI.getBenchmarks({ sort_by: 'score_desc', limit: 100 }),
      ]);
      setCategories(catRes.data?.data || []);
      setAllRows(rowRes.data?.data || []);
    } catch (err) {
      setCategories([]);
      setAllRows([]);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 섹션 파생: 정본은 DB 카테고리(/categories) 순서. 표시 카피는 CATEGORY_META 에서
  // category 키로 join, 없으면 category 원문을 폴백 라벨로(누락 0). 각 섹션은 동일
  // unit 축만 포함한다(R4).
  const sections = useMemo(() => {
    return categories.map((cat) => {
      const key = cat.category;
      const meta = CATEGORY_META[key] || {};
      // 분류는 DB 의 category 컬럼(r.category)으로 — 프론트 하드코딩 매핑 제거.
      const matched = allRows.filter((r) => r.category === key);
      const rows = dedupeByTool(matched);
      const scores = rows.map((r) => r.score).filter(Number.isFinite);
      const max = scores.length ? Math.max(...scores) : 0;
      const typeBadges = Array.from(
        new Set(matched.map((r) => r.benchmark_type).filter(Boolean))
      );
      // 섹션 unit 은 행의 실제 unit 우선(없으면 카테고리 메타 unit 폴백).
      const unit = matched.find((r) => r.unit)?.unit || cat.unit || 'percent';
      return {
        key,
        label: key, // 라벨 = DB category 원문(코드 카피가 없어도 누락 0).
        labelEn: meta.labelEn || '',
        desc: meta.desc || '',
        unit,
        rows,
        max,
        typeBadges,
      };
    });
  }, [categories, allRows]);

  // 진입 stagger 순서: 데이터가 있는(rows>0) 섹션만 순차 인덱스를 부여한다.
  // 빈 섹션은 맵에서 빠지므로 delay 0으로 즉시 표시(로딩 오인 방지).
  const nonEmptyOrder = useMemo(() => {
    const map = new Map();
    let order = 0;
    sections.forEach((sec) => {
      if (sec.rows.length > 0) {
        map.set(sec.key, order);
        order += 1;
      }
    });
    return map;
  }, [sections]);

  // 비교 토글(동일 tool_id면 모든 섹션에서 동기 체크).
  const isSelected = useCallback(
    (toolId) => selected.some((s) => s.tool_id === toolId),
    [selected]
  );

  const toggleCompare = useCallback((row) => {
    setSelected((prev) => {
      const exists = prev.some((s) => s.tool_id === row.tool_id);
      if (exists) return prev.filter((s) => s.tool_id !== row.tool_id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, { tool_id: row.tool_id, tool_name: row.tool_name }];
    });
  }, []);

  const removeCompare = useCallback((toolId) => {
    setSelected((prev) => prev.filter((s) => s.tool_id !== toolId));
  }, []);

  const clearCompare = useCallback(() => {
    setSelected([]);
    setPanelOpen(false);
  }, []);

  const trayFull = selected.length >= MAX_COMPARE;

  // 다축 매트릭스: 선택 도구 × 5축 raw 점수(없으면 null).
  // 각 축은 자체 unit·자체 정규화(단위 혼합 안전, 스펙 C10/C11).
  const matrix = useMemo(() => {
    return sections.map((sec) => {
      const cells = selected.map((s) => {
        const row = sec.rows.find((r) => r.tool_id === s.tool_id);
        return {
          tool_id: s.tool_id,
          tool_name: s.tool_name,
          score: row ? row.score : null,
          source: row?.source || null,
          modelVersion: row?.model_version || null,
        };
      });
      const vals = cells.map((c) => c.score).filter(Number.isFinite);
      return {
        key: sec.key,
        label: sec.label,
        unit: sec.unit,
        max: vals.length ? Math.max(...vals) : 0,
        cells,
      };
    });
  }, [sections, selected]);

  // 레이더 폴백 규칙(스펙 C9): 점수 있는 축<3 또는 도구>5면 막대그룹 강제.
  const axesWithData = matrix.filter((m) =>
    m.cells.some((c) => Number.isFinite(c.score))
  ).length;
  const radarAllowed = axesWithData >= 3 && selected.length <= MAX_COMPARE;

  const openPanel = useCallback(() => {
    setPanelOpen(true);
    // 인플레이스 확장 후 패널로 스크롤(스펙 Q4: 같은 페이지 확장).
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // 레이더 비활성 시 막대그룹으로 폴백 강제.
  useEffect(() => {
    if (view === 'radar' && !radarAllowed) setView('bars');
  }, [view, radarAllowed]);

  // IntersectionObserver로 활성 앵커 칩 동기화.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveKey(visible[0].target.id.replace('section-', ''));
        }
      },
      { rootMargin: '-64px 0px -60% 0px', threshold: [0, 0.25, 0.5, 1] }
    );
    sections.forEach((sec) => {
      const el = document.getElementById(`section-${sec.key}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // DB 카테고리 적재 후 활성 앵커를 첫 섹션으로 초기화(아직 미설정일 때만).
  useEffect(() => {
    if (activeKey === null && sections.length > 0) {
      setActiveKey(sections[0].key);
    }
  }, [activeKey, sections]);

  return (
    <div className="benchmarks-page">
      <div className="page-header">
        <p className="page-eyebrow">벤치마크</p>
        <h1 className="page-title">벤치마크 리더보드</h1>
        <p className="page-subtitle">
          카테고리별 공개 벤치마크 점수로 AI 도구를 스캔하고 다축으로 비교하세요
        </p>
      </div>

      <div className="benchmarks-container">
        {loading ? (
          <LoadingState message="벤치마크를 불러오는 중..." />
        ) : error ? (
          <ErrorState onRetry={fetchAll} message={error?.message} errorId={error?.errorId} />
        ) : allRows.length === 0 ? (
          <EmptyNoDataState
            title="아직 등록된 벤치마크가 없습니다"
            badge="수동 큐레이션"
            message="공개 벤치마크 점수를 카테고리별로 정리해 등록합니다. 등록되면 여기에서 카테고리별 리더보드로 확인할 수 있어요."
            ctaLabel="도구 탐색하기"
            ctaTo="/"
          />
        ) : (
          <>
            {/* C1. 카테고리 앵커 네비(sticky) */}
            <nav className="category-anchor-nav" aria-label="벤치마크 카테고리">
              <ul className="category-anchor-list">
                {sections.map((sec) => {
                  const active = sec.key === activeKey;
                  return (
                    <li key={sec.key}>
                      <a
                        href={`#section-${sec.key}`}
                        className={`filter-btn category-anchor-chip${
                          active ? ' active' : ''
                        }`}
                        aria-current={active ? 'true' : undefined}
                      >
                        {sec.label}
                        <span className="chip-count" aria-hidden="true">
                          {sec.rows.length}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* C6. 비교 트레이(sticky) */}
            <div className="compare-tray" role="region" aria-label="비교 트레이">
              {/* 비교 트레이 변동·뷰 전환을 스크린리더에 고지(E-17/E-14). */}
              <p className="sr-only" aria-live="polite">
                {trayFull
                  ? `비교 도구 ${selected.length}개 선택됨, 최대 ${MAX_COMPARE}개에 도달했습니다`
                  : `비교 도구 ${selected.length}개 선택됨`}
              </p>
              <div className="compare-tray-left">
                <span className="compare-counter-pill">
                  {selected.length} / {MAX_COMPARE}
                </span>
                {selected.length === 0 ? (
                  <span className="compare-tray-hint">
                    비교할 도구를 담아주세요(섹션의 담기 체크)
                  </span>
                ) : (
                  <ul className="compare-chip-list">
                    {selected.map((s) => (
                      <li key={s.tool_id}>
                        <span className="active-filter-chip">
                          {s.tool_name}
                          <button
                            type="button"
                            className="active-filter-chip-remove"
                            aria-label={`${s.tool_name} 비교에서 제거`}
                            onClick={() => removeCompare(s.tool_id)}
                          >
                            ×
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="compare-tray-right">
                <button
                  type="button"
                  className="button-primary"
                  disabled={selected.length === 0}
                  onClick={openPanel}
                >
                  다축 비교
                </button>
                {selected.length > 0 && (
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={clearCompare}
                  >
                    비우기
                  </button>
                )}
              </div>
              {trayFull && (
                <p className="compare-tray-max">최대 5개까지 비교</p>
              )}
            </div>

            {/* C8. 다축 비교 패널(인플레이스 확장) */}
            {panelOpen && selected.length > 0 && (
              <section
                className="multi-axis-panel"
                ref={panelRef}
                aria-labelledby="multi-axis-title"
              >
                <div className="multi-axis-header">
                  <h2 id="multi-axis-title" className="multi-axis-title">
                    다축 비교 · {selected.length}개 도구
                  </h2>
                  {/* C9. 뷰 토글(segmented) */}
                  <div
                    className="view-toggle"
                    role="tablist"
                    aria-label="비교 뷰 전환"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'bars'}
                      className={`view-toggle-seg${
                        view === 'bars' ? ' active' : ''
                      }`}
                      onClick={() => setView('bars')}
                    >
                      막대그룹
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === 'radar'}
                      aria-disabled={!radarAllowed}
                      className={`view-toggle-seg${
                        view === 'radar' ? ' active' : ''
                      }${!radarAllowed ? ' is-disabled' : ''}`}
                      onClick={() => radarAllowed && setView('radar')}
                    >
                      레이더
                    </button>
                  </div>
                </div>

                {!radarAllowed && (
                  <p className="view-toggle-caption">
                    레이더는 3개 이상 축·5개 이하 도구에서 제공됩니다.
                  </p>
                )}

                <div role="tabpanel" aria-labelledby="multi-axis-title">
                  {view === 'radar' && radarAllowed ? (
                    <ComparisonRadar matrix={matrix} tools={selected} />
                  ) : (
                    <ComparisonBarGroup matrix={matrix} />
                  )}
                </div>

                <p className="multi-axis-note">
                  막대·꼭짓점 길이는 0 기준 절대 비율입니다(percent 축은 만점 100,
                  Elo 축은 절대 만점이 없어 비교 도구 중 최고점을 기준으로 둡니다).
                  섹션 리더보드 막대와 동일한 기준이며, 비교 기준은 아래 표의 점수
                  숫자입니다.
                </p>

                {/* C12. 데이터 표(항상 DOM — 접근성 SSOT) */}
                <ComparisonDataTable matrix={matrix} tools={selected} />
              </section>
            )}

            {/* 카테고리 섹션 ×5 */}
            {sections.map((sec) => {
              // stagger delay는 데이터가 있는 섹션 순서로만 누적한다.
              // 빈(0행) 섹션이 인덱스를 먹으면 시각 리듬이 끊기고,
              // 빈 상태 카드가 늦게 떠 "로딩 중" 오인을 주는 문제를 막는다.
              const order = nonEmptyOrder.get(sec.key);
              const delayMs = order === undefined ? 0 : order * 100;
              return (
              <section
                key={sec.key}
                id={`section-${sec.key}`}
                className="benchmark-section"
                aria-labelledby={`section-title-${sec.key}`}
                style={{ animationDelay: `${delayMs}ms` }}
              >
                <header className="benchmark-section-header">
                  <div className="benchmark-section-heading">
                    <h2
                      id={`section-title-${sec.key}`}
                      className="benchmark-section-title"
                    >
                      {sec.label}
                      {sec.labelEn && (
                        <span className="benchmark-section-title-en">
                          {sec.labelEn}
                        </span>
                      )}
                    </h2>
                    {sec.desc && (
                      <p className="benchmark-section-desc">{sec.desc}</p>
                    )}
                  </div>
                  {sec.typeBadges.length > 0 && (
                    <div className="benchmark-type-badges">
                      {sec.typeBadges.map((t) => (
                        <span key={t} className="benchmark-type-badge">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </header>

                {sec.rows.length === 0 ? (
                  <EmptyNoDataState
                    title="이 카테고리 점수가 아직 없습니다"
                    message="점수가 등록되면 여기에 리더보드가 채워집니다."
                    inline
                  />
                ) : (
                  <BarGroupLeaderboard
                    sec={sec}
                    isSelected={isSelected}
                    toggleCompare={toggleCompare}
                    trayFull={trayFull}
                  />
                )}
              </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

// C4. 막대그룹 리더보드(데스크톱 테이블 + 모바일 카드).
const BarGroupLeaderboard = ({ sec, isSelected, toggleCompare, trayFull }) => {
  return (
    <>
      {/* 데스크톱: 테이블 */}
      <div className="leaderboard">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th scope="col" className="col-rank">
                순위
              </th>
              <th scope="col">도구</th>
              <th scope="col" className="col-score">
                점수
              </th>
              <th scope="col">점수 막대</th>
              <th scope="col">출처</th>
              <th scope="col" className="col-compare">
                담기
              </th>
            </tr>
          </thead>
          <tbody>
            {sec.rows.map((row, idx) => {
              const rank = idx + 1;
              const top = rank <= 3;
              const picked = isSelected(row.tool_id);
              const scoreText = formatScore(row.score, sec.unit);
              const snapshot = formatSnapshot(row.collected_date);
              const disabled = trayFull && !picked;
              return (
                <tr
                  key={row.id}
                  className={picked ? 'leaderboard-row--picked' : undefined}
                >
                  <th
                    scope="row"
                    className={`col-rank${top ? ' rank-top' : ''}`}
                  >
                    {rank}
                  </th>
                  <td>
                    <Link
                      to={`/details/${row.tool_id}`}
                      className="leaderboard-tool"
                    >
                      {row.tool_name}
                    </Link>
                  </td>
                  <td className="col-score">{scoreText}</td>
                  <td>
                    {/* 점수·순위는 인접 셀이 SSOT로 낭독하므로 막대는 장식 처리(E-19). */}
                    <div
                      className={`bar-track${picked ? ' bar-track--picked' : ''}`}
                      aria-hidden="true"
                    >
                      <div
                        className="bar-fill"
                        style={{
                          width: `${barPct(row.score, sec.unit, sec.max)}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="col-source">
                    <span className="source-name">{row.source || '-'}</span>
                    {snapshot && (
                      <span className="source-snapshot">{snapshot}</span>
                    )}
                  </td>
                  <td className="col-compare">
                    <label className="compare-checkbox">
                      <input
                        type="checkbox"
                        checked={picked}
                        disabled={disabled}
                        aria-disabled={disabled}
                        aria-label={
                          disabled
                            ? `${row.tool_name}를 비교에 담기 (최대 ${MAX_COMPARE}개에 도달, 추가하려면 먼저 제거하세요)`
                            : `${row.tool_name}를 비교에 담기`
                        }
                        title={
                          disabled
                            ? `최대 ${MAX_COMPARE}개까지 비교할 수 있습니다`
                            : undefined
                        }
                        onChange={() => toggleCompare(row)}
                      />
                      <span className="compare-checkbox-box" aria-hidden="true">
                        ✓
                      </span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일: 행 카드 스택 */}
      <div className="leaderboard-cards">
        {sec.rows.map((row, idx) => {
          const rank = idx + 1;
          const top = rank <= 3;
          const picked = isSelected(row.tool_id);
          const scoreText = formatScore(row.score, sec.unit);
          const snapshot = formatSnapshot(row.collected_date);
          const disabled = trayFull && !picked;
          return (
            <div
              key={row.id}
              className={`leaderboard-card${
                picked ? ' leaderboard-card--picked' : ''
              }`}
            >
              <div className="leaderboard-card-top">
                <span
                  className={`leaderboard-card-rank${
                    top ? ' rank-top' : ''
                  }`}
                >
                  순위 {rank}
                </span>
                <Link
                  to={`/details/${row.tool_id}`}
                  className="leaderboard-tool"
                >
                  {row.tool_name}
                </Link>
              </div>
              <div className="leaderboard-card-score-row">
                <span className="leaderboard-card-score">{scoreText}</span>
                <div
                  className={`bar-track${picked ? ' bar-track--picked' : ''}`}
                  aria-hidden="true"
                >
                  <div
                    className="bar-fill"
                    style={{
                      width: `${barPct(row.score, sec.unit, sec.max)}%`,
                    }}
                  />
                </div>
              </div>
              <div className="leaderboard-card-meta">
                <span className="leaderboard-card-source">
                  {row.source || '-'}
                  {snapshot ? ` · ${snapshot}` : ''}
                </span>
                <label className="compare-checkbox">
                  <input
                    type="checkbox"
                    checked={picked}
                    disabled={disabled}
                    aria-disabled={disabled}
                    aria-label={
                      disabled
                        ? `${row.tool_name}를 비교에 담기 (최대 ${MAX_COMPARE}개에 도달, 추가하려면 먼저 제거하세요)`
                        : `${row.tool_name}를 비교에 담기`
                    }
                    title={
                      disabled
                        ? `최대 ${MAX_COMPARE}개까지 비교할 수 있습니다`
                        : undefined
                    }
                    onChange={() => toggleCompare(row)}
                  />
                  <span className="compare-checkbox-box" aria-hidden="true">
                    ✓
                  </span>
                  <span className="compare-checkbox-label">담기</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <p className="leaderboard-caption">
        {sec.unit === 'elo'
          ? '막대 길이는 0 기준, 이 축 최고점 대비 비율입니다(Elo 는 절대 만점이 없어 최고점을 기준으로 둡니다). 비교 기준은 점수 숫자입니다.'
          : '막대 길이는 0~100점(만점 100) 기준 절대 비율입니다. 비교 기준은 점수 숫자입니다.'}
      </p>
    </>
  );
};

// C10. 다축 막대그룹(축별 그룹, 도구별 막대). 발견 #7: barPct 로 섹션 리더보드와
// 동일 정규화(0 기준 절대 비율). 발견 #9: 점수 옆 출처(source) 표기.
const ComparisonBarGroup = ({ matrix }) => {
  return (
    <div className="comparison-bar-group">
      {matrix.map((axis) => (
        <div key={axis.key} className="comparison-axis">
          <h3 className="comparison-axis-title">
            {axis.label}
            <span className="comparison-axis-unit">
              {axis.unit === 'elo' ? '(Elo)' : '(점 / 100)'}
            </span>
          </h3>
          <ul className="comparison-axis-bars">
            {axis.cells.map((cell) => {
              const has = Number.isFinite(cell.score);
              const text = has ? formatScore(cell.score, axis.unit) : '-';
              const srcLabel = has && cell.source ? `, 출처 ${cell.source}` : '';
              return (
                <li key={cell.tool_id} className="comparison-axis-bar-row">
                  <span className="comparison-bar-label">{cell.tool_name}</span>
                  <div
                    className="bar-track"
                    role="img"
                    aria-label={`${cell.tool_name}, ${axis.label} ${text}${srcLabel}`}
                  >
                    <div
                      className="bar-fill"
                      aria-hidden="true"
                      style={{ width: `${barPct(cell.score, axis.unit, axis.max)}%` }}
                    />
                  </div>
                  <span className="comparison-bar-value">
                    {text}
                    {has && cell.source && (
                      <span className="comparison-bar-source">{cell.source}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

// 도구별 마커 글리프(색 단독 금지 — 범례/꼭짓점 매칭).
const TOOL_MARKERS = ['●', '▲', '■', '◆', '+'];

// C11. 순수 SVG 레이더(라이브러리 금지). 5축 정오각형, 축별 독립 정규화.
const ComparisonRadar = ({ matrix, tools }) => {
  const SIZE = 320;
  const CENTER = 160;
  const RADIUS = 120;
  const axes = matrix; // 5축 순서 고정.
  const n = axes.length;

  // 각 꼭짓점의 단위 벡터(상단 12시 시작, 시계방향).
  const angleFor = (i) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const pointAt = (i, ratio) => {
    const a = angleFor(i);
    return {
      x: CENTER + RADIUS * ratio * Math.cos(a),
      y: CENTER + RADIUS * ratio * Math.sin(a),
    };
  };

  // 그리드 링 4단.
  const rings = [0.25, 0.5, 0.75, 1].map((r) =>
    axes
      .map((_, i) => {
        const p = pointAt(i, r);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ')
  );

  // 도구별 폴리곤. 발견 #7: 비율은 0 기준 절대(percent→/100, elo→/축 최고점) —
  // 막대 뷰와 동일 기준. 발견 #8: 결측 셀은 중심(0)으로 찍지 않고 폴리곤·마커에서
  // 제외한다(결측을 "최저점"으로 오독시키지 않음). 결측이 있으면 폴리곤이 열린
  // 형태(개곡선)가 되며, 정확한 값은 표가 SSOT.
  const polygons = tools.map((tool, ti) => {
    const present = []; // { i, point } — 점수 있는 축만.
    let hasMissing = false;
    axes.forEach((axis, i) => {
      const cell = axis.cells.find((c) => c.tool_id === tool.tool_id);
      const has = cell && Number.isFinite(cell.score);
      if (!has) {
        hasMissing = true;
        return;
      }
      const denom = axis.unit === 'elo' ? axis.max : 100;
      const ratio = denom > 0 ? Math.min(1, cell.score / denom) : 0;
      present.push({ i, point: pointAt(i, ratio) });
    });
    return {
      tool,
      marker: TOOL_MARKERS[ti % TOOL_MARKERS.length],
      inkClass: `radar-ink-${ti % 3}`,
      hasMissing,
      // 점수 ≥3 축이면 닫힌 폴리곤, 2축이면 선분, 1축이면 점만(폴리곤 생략).
      polyStr: present
        .map((p) => `${p.point.x.toFixed(1)},${p.point.y.toFixed(1)}`)
        .join(' '),
      vertices: present,
    };
  });

  // 결측이 하나라도 있으면 desc/캡션에 처리 방식을 명시(접근성).
  const anyMissing = polygons.some((p) => p.hasMissing);

  return (
    <div className="comparison-radar-wrap">
      <svg
        className="comparison-radar"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-labelledby="radar-title radar-desc"
      >
        <title id="radar-title">다축 레이더 비교</title>
        <desc id="radar-desc">
          {tools.map((t) => t.tool_name).join(', ')}의 카테고리별 0 기준 점수
          비율. 점수가 없는 축은 그리지 않습니다(중심 0 으로 찍지 않음 — 최저점이
          아닌 결측). 정확한 수치는 아래 데이터 표를 참고하세요.
        </desc>

        {/* 그리드 링 */}
        {rings.map((r, i) => (
          <polygon key={i} className="radar-ring" points={r} />
        ))}

        {/* 축선 */}
        {axes.map((_, i) => {
          const p = pointAt(i, 1);
          return (
            <line
              key={i}
              className="radar-axis-line"
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
            />
          );
        })}

        {/* 도구 폴리곤. 결측 축은 꼭짓점에서 제외 — 결측이 있으면 폴리곤이 열린
            형태(개곡선)가 되어 결측을 0 으로 오독시키지 않는다(발견 #8). */}
        {polygons.map((poly) => (
          <g key={poly.tool.tool_id}>
            {poly.vertices.length >= 3 ? (
              <polygon
                className={`radar-polygon ${poly.inkClass}${
                  poly.hasMissing ? ' radar-polygon--partial' : ''
                }`}
                points={poly.polyStr}
              />
            ) : poly.vertices.length === 2 ? (
              <polyline
                className={`radar-polyline ${poly.inkClass}`}
                points={poly.polyStr}
              />
            ) : null}
            {poly.vertices.map((v) => (
              <text
                key={v.i}
                className={`radar-vertex-marker ${poly.inkClass}`}
                x={v.point.x}
                y={v.point.y}
                textAnchor="middle"
                dominantBaseline="central"
                aria-hidden="true"
              >
                {poly.marker}
              </text>
            ))}
          </g>
        ))}

        {/* 축 라벨 */}
        {axes.map((axis, i) => {
          const p = pointAt(i, 1.14);
          const anchor =
            Math.abs(p.x - CENTER) < 8
              ? 'middle'
              : p.x > CENTER
              ? 'start'
              : 'end';
          return (
            <text
              key={axis.key}
              className="radar-axis-label"
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="central"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* 범례 */}
      <ul className="radar-legend">
        {polygons.map((poly) => (
          <li key={poly.tool.tool_id} className="radar-legend-item">
            <span
              className={`radar-legend-marker ${poly.inkClass}`}
              aria-hidden="true"
            >
              {poly.marker}
            </span>
            <span className="radar-legend-label">
              {poly.tool.tool_name}
              {poly.hasMissing && (
                <span className="radar-legend-missing"> · 일부 축 점수 없음</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {anyMissing && (
        <p className="radar-missing-caption">
          점수가 없는 축은 그리지 않아 도형이 열려 있을 수 있습니다. 빈 축은 0점이
          아니라 데이터 없음(아래 표에 '-')입니다.
        </p>
      )}
    </div>
  );
};

// C12. 데이터 표(항상 DOM). 첫 열 도구명, 컬럼 = 5축. 결측 '-'.
const ComparisonDataTable = ({ matrix, tools }) => {
  return (
    <div className="comparison-data-table-wrap">
      <table className="comparison-data-table">
        <thead>
          <tr>
            <th scope="col" className="comparison-data-corner">
              도구 \ 축
            </th>
            {matrix.map((axis) => (
              <th key={axis.key} scope="col">
                {axis.label}
                <span className="comparison-data-unit">
                  {axis.unit === 'elo' ? ' (Elo)' : ' (점 / 100)'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.tool_id}>
              <th scope="row" className="comparison-data-rowhead">
                {tool.tool_name}
              </th>
              {matrix.map((axis) => {
                const cell = axis.cells.find(
                  (c) => c.tool_id === tool.tool_id
                );
                const has = cell && Number.isFinite(cell.score);
                return (
                  <td
                    key={axis.key}
                    className={has ? undefined : 'comparison-data-empty'}
                  >
                    {has ? (
                      <>
                        <span className="comparison-data-score">
                          {formatScore(cell.score, axis.unit)}
                        </span>
                        {/* 발견 #9: 출처·모델 버전 표기. */}
                        {(cell.source || cell.modelVersion) && (
                          <span className="comparison-data-source">
                            {[cell.modelVersion, cell.source]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="comparison-data-caption">
        점수는 raw 값입니다. percent 축은 만점 100 기준, Elo 는 상대 점수(만점 없음).
        출처·모델 버전은 점수 아래에 표기됩니다.
      </p>
    </div>
  );
};

export default Benchmarks;
