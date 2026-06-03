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
 * 카테고리 정본은 백엔드 스키마에 아직 없다(benchmarks 테이블은 benchmark_type만 보유,
 * category/unit/model_version 컬럼 없음). 따라서 카테고리·단위·라벨은 프론트의
 * 표현 계층 매핑으로 파생한다 — 임의 데이터 생성이 아니라 기존 benchmark_type을
 * 5개 축으로 그룹핑하는 결정적 매핑이다. 백엔드에 category/unit이 추가되면
 * 이 매핑을 응답값으로 대체한다(후속 작업).
 *
 * 각 카테고리는 동일 unit 축만 포함한다(스펙 R4: 단위 혼합 금지).
 */
// 카테고리 표시 메타(UI 카피). key 는 백엔드 benchmarks.category 값과 1:1 일치한다.
// 분류 자체는 DB 의 category 컬럼(응답 r.category)으로 하므로 하드코딩 매핑이 아니다
// (헌법 G5/G6: 필터값 DB 동기화). unit 도 행의 r.unit 을 우선 사용하고 여기 값은 폴백.
const CATEGORIES = [
  {
    key: '추론',
    label: '추론',
    labelEn: 'Reasoning',
    desc: '대학원 수준 과학·지식 추론(GPQA Diamond·MMLU-Pro)',
    unit: 'percent',
  },
  {
    key: '코딩',
    label: '코딩',
    labelEn: 'Coding',
    desc: '실전 코드 수정·생성 정확도(SWE-bench Verified·LiveCodeBench)',
    unit: 'percent',
  },
  {
    key: '수학',
    label: '수학',
    labelEn: 'Math',
    desc: '경시·다단계 수학 문제 해결(AIME 2025·MATH-500)',
    unit: 'percent',
  },
  {
    key: '멀티모달',
    label: '멀티모달',
    labelEn: 'Multimodal',
    desc: '이미지와 텍스트를 결합한 추론(MMMU)',
    unit: 'percent',
  },
  {
    key: '선호',
    label: '선호',
    labelEn: 'Preference',
    desc: '사람 선호 기반 상대 평가(LMArena Elo)',
    unit: 'elo',
  },
];

const MAX_COMPARE = 5;

// raw 점수 + 단위 포맷(스펙 C4). percent→소수1자리%, elo→정수 Elo.
const formatScore = (score, unit) => {
  if (!Number.isFinite(score)) return '-';
  if (unit === 'elo') return `${Math.round(score)} Elo`;
  return `${score.toFixed(1)}%`;
};

// snapshot 날짜 → 'YYYY-MM' 표기. 없으면 null.
const formatSnapshot = (dateStr) => {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
};

// 섹션(축) 내 min-max 정규화 + 시각 최소폭 8% floor(스펙 C4).
const barPctInSection = (score, min, max) => {
  if (!Number.isFinite(score)) return 0;
  if (max <= min) return 100;
  const norm = (score - min) / (max - min);
  return 8 + norm * 92;
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
  // 전체 벤치마크 1회 적재 후 카테고리별 클라이언트 분류.
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 비교 트레이: 선택 도구(최대 5). { tool_id, tool_name } 보관.
  const [selected, setSelected] = useState([]);

  // 다축 패널 표시 여부 + 뷰 모드('bars' | 'radar').
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState('bars');

  // 활성 앵커 섹션(IntersectionObserver 동기화).
  const [activeKey, setActiveKey] = useState(CATEGORIES[0].key);

  const panelRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await benchmarksAPI.getBenchmarks({
        sort_by: 'score_desc',
        limit: 100,
      });
      setAllRows(res.data?.data || []);
    } catch (err) {
      setAllRows([]);
      setError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 카테고리별 행 그룹(파생). 각 섹션은 동일 unit 축만 포함하므로
  // min-max 정규화가 안전하다(R4).
  const sections = useMemo(() => {
    return CATEGORIES.map((cat) => {
      // 분류는 DB 의 category 컬럼(r.category)으로 — 프론트 하드코딩 매핑 제거.
      const matched = allRows.filter((r) => r.category === cat.key);
      const rows = dedupeByTool(matched);
      const scores = rows.map((r) => r.score).filter(Number.isFinite);
      const min = scores.length ? Math.min(...scores) : 0;
      const max = scores.length ? Math.max(...scores) : 0;
      const typeBadges = Array.from(
        new Set(matched.map((r) => r.benchmark_type).filter(Boolean))
      );
      // 섹션 unit 은 행의 실제 unit 우선(없으면 카테고리 폴백).
      const unit = matched.find((r) => r.unit)?.unit || cat.unit;
      return { ...cat, unit, rows, min, max, typeBadges };
    });
  }, [allRows]);

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
    CATEGORIES.forEach((cat) => {
      const el = document.getElementById(`section-${cat.key}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

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
          <ErrorState onRetry={fetchAll} message={error} />
        ) : allRows.length === 0 ? (
          <EmptyNoDataState
            title="아직 등록된 벤치마크가 없습니다"
            badge="매일 수집 중 · Coming soon"
            message="수집 파이프라인이 매일 새 데이터를 모으고 있어요. 곧 지금 뜨는 도구를 여기서 확인할 수 있습니다."
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
                  각 축은 해당 벤치마크 내 상대값입니다(단위 상이). 비교 기준은
                  아래 표의 점수 숫자입니다.
                </p>

                {/* C12. 데이터 표(항상 DOM — 접근성 SSOT) */}
                <ComparisonDataTable matrix={matrix} tools={selected} />
              </section>
            )}

            {/* 카테고리 섹션 ×5 */}
            {sections.map((sec) => (
              <section
                key={sec.key}
                id={`section-${sec.key}`}
                className="benchmark-section"
                aria-labelledby={`section-title-${sec.key}`}
              >
                <header className="benchmark-section-header">
                  <div className="benchmark-section-heading">
                    <h2
                      id={`section-title-${sec.key}`}
                      className="benchmark-section-title"
                    >
                      {sec.label}
                      <span className="benchmark-section-title-en">
                        {sec.labelEn}
                      </span>
                    </h2>
                    <p className="benchmark-section-desc">{sec.desc}</p>
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
                    message="수집되면 여기에 리더보드가 채워집니다."
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
            ))}
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
                          width: `${barPctInSection(
                            row.score,
                            sec.min,
                            sec.max
                          )}%`,
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
                      width: `${barPctInSection(row.score, sec.min, sec.max)}%`,
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
        막대 길이는 이 축 내 상대값입니다. 비교 기준은 점수 숫자입니다.
      </p>
    </>
  );
};

// C10. 다축 막대그룹(축별 그룹, 도구별 막대). 축마다 자체 unit·자체 정규화.
const ComparisonBarGroup = ({ matrix }) => {
  return (
    <div className="comparison-bar-group">
      {matrix.map((axis) => (
        <div key={axis.key} className="comparison-axis">
          <h3 className="comparison-axis-title">
            {axis.label}
            <span className="comparison-axis-unit">
              {axis.unit === 'elo' ? '(Elo)' : '(%)'}
            </span>
          </h3>
          <ul className="comparison-axis-bars">
            {axis.cells.map((cell) => {
              const has = Number.isFinite(cell.score);
              const pct = has && axis.max > 0 ? (cell.score / axis.max) * 100 : 0;
              const text = has ? formatScore(cell.score, axis.unit) : '-';
              return (
                <li key={cell.tool_id} className="comparison-axis-bar-row">
                  <span className="comparison-bar-label">{cell.tool_name}</span>
                  <div
                    className="bar-track"
                    role="img"
                    aria-label={`${cell.tool_name}, ${axis.label} ${text}`}
                  >
                    <div
                      className="bar-fill"
                      aria-hidden="true"
                      style={{ width: `${Math.max(has ? 8 : 0, pct)}%` }}
                    />
                  </div>
                  <span className="comparison-bar-value">{text}</span>
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

  // 도구별 폴리곤(축별 max=외곽). 결측 셀은 중심(0) 처리하되 표에 '-'로 진실 노출.
  const polygons = tools.map((tool, ti) => {
    const pts = axes.map((axis, i) => {
      const cell = axis.cells.find((c) => c.tool_id === tool.tool_id);
      const ratio =
        cell && Number.isFinite(cell.score) && axis.max > 0
          ? cell.score / axis.max
          : 0;
      return pointAt(i, ratio);
    });
    return {
      tool,
      marker: TOOL_MARKERS[ti % TOOL_MARKERS.length],
      inkClass: `radar-ink-${ti % 3}`,
      polyStr: pts
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' '),
      vertices: pts,
    };
  });

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
          {tools.map((t) => t.tool_name).join(', ')}의 카테고리별 상대 점수.
          정확한 수치는 아래 데이터 표를 참고하세요.
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

        {/* 도구 폴리곤 */}
        {polygons.map((poly) => (
          <g key={poly.tool.tool_id}>
            <polygon
              className={`radar-polygon ${poly.inkClass}`}
              points={poly.polyStr}
            />
            {poly.vertices.map((v, vi) => (
              <text
                key={vi}
                className={`radar-vertex-marker ${poly.inkClass}`}
                x={v.x}
                y={v.y}
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
            <span className="radar-legend-label">{poly.tool.tool_name}</span>
          </li>
        ))}
      </ul>
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
                  {axis.unit === 'elo' ? ' (Elo)' : ' (%)'}
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
                    {has ? formatScore(cell.score, axis.unit) : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Benchmarks;
