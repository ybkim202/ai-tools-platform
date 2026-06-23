import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toolsAPI, handleApiError } from '../services/api';
import { useUIStore } from '../stores/toolStore';
import CompareTray from '../components/CompareTray';
import {
  LoadingState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import { formatUserCount, formatMetric } from '../utils/format';
import { safeHttpUrl } from '../utils/url';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import ExternalLinkIcon from '../components/ExternalLinkIcon';
import '../styles/Leaderboard.css';

// 랭킹 화면: "가장 많이 쓰이는 AI 도구"를 인기(사용자 수) 기준으로 줄세운다.
// 정렬 정본은 서버(tools API sort_by='popularity' = user_count DESC NULLS LAST) —
// 프론트는 서버 순서를 그대로 순위로 쓴다(임의 재정렬 금지). Benchmarks(성능 축)와
// 분리된 별개 축(인기)이라 화면을 따로 둔다. 핵심 지표 1개 승격: 행마다 인기 지표
// (오픈소스는 GitHub stars, 그 외 사용자 수)를 강조하고 나머지는 보조 메타로 강등.
const LIMIT = 50;
const MAX_COMPARE = 5;

const Leaderboard = () => {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectedToolsForCompare = useUIStore(
    (s) => s.selectedToolsForCompare
  );
  const addToolForCompare = useUIStore((s) => s.addToolForCompare);
  const removeToolForCompare = useUIStore((s) => s.removeToolForCompare);
  const compareFull = selectedToolsForCompare.length >= MAX_COMPARE;

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await toolsAPI.getTools({
        sort_by: 'popularity',
        limit: LIMIT,
      });
      setTools(res.data?.data || []);
    } catch (err) {
      setTools([]);
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  // 행 핵심 지표(카드와 동일 축 — 인기). 오픈소스는 stars, 그 외 사용자 수.
  // 둘 다 없으면 null(빈 강조 금지 — '-' 보조 표기로 대체).
  const headlineMetric = (tool) => {
    const stars =
      tool.is_open_source === true ? formatMetric(tool.github_stars) : null;
    if (stars) return { icon: '★', label: 'GitHub stars', value: stars };
    const users = formatUserCount(tool.user_count);
    if (users) return { icon: null, label: '사용자 수', value: users };
    return null;
  };

  return (
    <div className="leaderboard-page">
      <div className="page-header">
        <p className="page-eyebrow">랭킹</p>
        <h1 className="page-title">인기 AI 도구 랭킹</h1>
        <p className="page-subtitle">
          사용자 수 기준으로 가장 많이 쓰이는 AI 도구를 순위로 확인하세요. 성능
          벤치마크는 <Link to="/benchmarks">벤치마크</Link>에서 비교할 수 있어요.
        </p>
      </div>

      <div className="leaderboard-rank-container">
        {/* 비교 트레이 — store 자립 구독, 선택 도구 있을 때만 렌더(Home과 동일). */}
        <CompareTray />

        {loading ? (
          <LoadingState message="랭킹을 불러오는 중..." />
        ) : error ? (
          <ErrorState
            onRetry={fetchTools}
            message={error?.message}
            errorId={error?.errorId}
          />
        ) : tools.length === 0 ? (
          <EmptyNoDataState
            title="아직 표시할 도구가 없습니다"
            message="도구가 등록되면 인기 순으로 줄세워 보여드립니다."
            ctaLabel="도구 탐색하기"
            ctaTo="/"
          />
        ) : (
          <ol className="rank-list">
            {tools.map((tool, idx) => {
              const rank = idx + 1;
              const top = rank <= 3;
              const metric = headlineMetric(tool);
              const officialUrl = safeHttpUrl(tool.official_url);
              const isSelected = selectedToolsForCompare.includes(tool.id);
              const compareDisabled = !isSelected && compareFull;
              return (
                <li
                  key={tool.id}
                  className={`rank-item${isSelected ? ' rank-item--picked' : ''}`}
                >
                  {/* 순위 — 상위 3위 강조(색+굵기, 숫자 자체가 의미 채널). */}
                  <span className={`rank-num${top ? ' rank-num--top' : ''}`}>
                    {rank}
                  </span>

                  <Link to={`/details/${tool.id}`} className="rank-identity">
                    <img
                      src={resolveLogoSrc(tool.logo_url, tool.name, tool.official_url)}
                      alt=""
                      className="rank-logo"
                      loading="lazy"
                      data-official-url={tool.official_url || ''}
                      onError={handleLogoError}
                    />
                    <span className="rank-name-group">
                      <span className="rank-name">{tool.name}</span>
                      {tool.category && (
                        <span className="rank-category">{tool.category}</span>
                      )}
                    </span>
                  </Link>

                  {/* 핵심 지표 1개(인기) — 강조 승격. 색·크기 단독 금지 →
                      아이콘(있으면) + 숫자 + sr-only 라벨로 의미 병행. */}
                  <span className="rank-metric">
                    {metric ? (
                      <>
                        {metric.icon && (
                          <span className="rank-metric-icon" aria-hidden="true">
                            {metric.icon}
                          </span>
                        )}
                        <span className="rank-metric-value">{metric.value}</span>
                        <span className="sr-only">{metric.label}</span>
                      </>
                    ) : (
                      <span className="rank-metric-empty">-</span>
                    )}
                  </span>

                  {/* 라이선스(보조 메타) — 색 단독 금지: 점 문자 + 텍스트. */}
                  <span
                    className={`rank-license ${
                      tool.is_open_source ? 'is-open' : 'is-prop'
                    }`}
                  >
                    <span className="rank-license-dot" aria-hidden="true">
                      {tool.is_open_source ? '◆' : '◇'}
                    </span>
                    {tool.is_open_source ? '오픈소스' : '독점'}
                  </span>

                  <span className="rank-actions">
                    {officialUrl && (
                      <a
                        href={officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rank-visit"
                      >
                        방문
                        <ExternalLinkIcon />
                        <span className="sr-only">(새 창에서 열림)</span>
                      </a>
                    )}
                    <button
                      type="button"
                      className={`rank-compare${isSelected ? ' active' : ''}`}
                      aria-pressed={isSelected}
                      disabled={compareDisabled}
                      title={
                        isSelected
                          ? '비교 제거'
                          : compareDisabled
                          ? `비교는 최대 ${MAX_COMPARE}개까지 가능합니다`
                          : '비교 추가'
                      }
                      onClick={() =>
                        isSelected
                          ? removeToolForCompare(tool.id)
                          : addToolForCompare(tool.id, tool.name)
                      }
                    >
                      {isSelected ? '✓ 선택됨' : '비교'}
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        {!loading && !error && tools.length > 0 && (
          <p className="rank-caption">
            순위는 사용자 수(인기) 기준입니다. 사용자 수가 공개되지 않은 도구는
            뒤로 정렬됩니다. 표시 상한 {LIMIT}개.
          </p>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
