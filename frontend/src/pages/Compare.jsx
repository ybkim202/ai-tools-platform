import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';
import { compareAPI, handleApiError } from '../services/api';
import { formatUserCount } from '../utils/format';
import { handleLogoError } from '../utils/logoFallback';
import { difficultyDot } from '../utils/difficulty';
import {
  LoadingState,
  EmptyNoDataState,
  EmptyFilteredState,
  ErrorState,
} from '../components/states/StateViews';
import { SearchEmptyIcon } from '../components/states/StateIcons';
import '../styles/Compare.css';

const Compare = () => {
  const { selectedToolsForCompare, compareNamesById, clearCompareList } =
    useUIStore();
  const [comparisonData, setComparisonData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const fetchComparison = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await compareAPI.compareTools(selectedToolsForCompare);
      // 표준 포맷: { success, data: { comparison: [...], total_tools: N }, error }.
      const list = response.data?.data?.comparison;
      setComparisonData(Array.isArray(list) ? list : []);
    } catch (err) {
      const error = handleApiError(err);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedToolsForCompare]);

  useEffect(() => {
    if (selectedToolsForCompare.length > 0) {
      fetchComparison();
    }
  }, [selectedToolsForCompare, fetchComparison]);

  // 일부 누락 시 빠진 도구의 이름 산출(반환 결과의 id 집합과 선택 id를 diff).
  // 이름은 선택 시점 store 캐시(compareNamesById)에서 읽음 — 추가 API 호출 없음.
  const returnedIds = new Set(
    (comparisonData ?? []).map((tool) => tool?.id)
  );
  const missingToolNames = selectedToolsForCompare
    .filter((id) => !returnedIds.has(id))
    .map((id) => compareNamesById[id] || `#${id}`);

  if (selectedToolsForCompare.length === 0) {
    return (
      <div className="compare-page">
        <EmptyNoDataState
          title="비교할 도구를 선택해주세요"
          message="홈에서 도구의 '비교' 버튼을 누르면 여기서 나란히 비교할 수 있어요."
          badge={null}
          icon={<SearchEmptyIcon />}
          ctaLabel="도구 탐색하기"
          ctaTo="/"
        />
      </div>
    );
  }

  return (
    <div className="compare-page">
      <div className="page-header">
        <p className="page-eyebrow">비교</p>
        <h1 className="page-title">AI 도구 비교</h1>
        <p className="page-subtitle">
          {selectedToolsForCompare.length}개의 도구를 나란히 비교하고 있습니다
        </p>
        <div className="page-header-actions">
          <span className="counter-pill" aria-live="polite">
            선택 {selectedToolsForCompare.length} / 5
          </span>
          <button
            type="button"
            className="ghost-button"
            onClick={clearCompareList}
          >
            초기화
          </button>
        </div>
      </div>

      {loading && <LoadingState message="비교 정보를 불러오는 중..." />}
      {!loading && error && (
        <ErrorState message={error} onRetry={fetchComparison} />
      )}

      {/* 선택은 했으나 결과가 0건: 일부/전체 ID가 DB에 없는 경우 침묵 방지 */}
      {!loading && !error && comparisonData && comparisonData.length === 0 && (
        <EmptyFilteredState
          title="비교 결과를 찾을 수 없습니다"
          message="선택한 도구의 정보를 불러오지 못했어요. 목록을 초기화하고 다시 선택해주세요."
          onReset={clearCompareList}
          resetLabel="선택 초기화"
        />
      )}

      {/* 일부만 누락(결과 수 < 선택 수): 비교는 보여주되 안내 노출 */}
      {!loading && !error && comparisonData && comparisonData.length > 0 &&
        comparisonData.length < selectedToolsForCompare.length && (
        <p className="compare-partial-notice" role="status" aria-live="polite">
          선택한 {selectedToolsForCompare.length}개 중 {comparisonData.length}개의 정보만 표시됩니다.
          {missingToolNames.length > 0 && (
            <>
              {' '}
              <strong className="compare-missing-names">
                {missingToolNames.join(', ')}
              </strong>{' '}
              정보를 불러오지 못했습니다.
            </>
          )}
        </p>
      )}

      {!loading && !error && comparisonData && comparisonData.length > 0 && (
        <>
        <div
          className="comparison-table"
          aria-live="polite"
          role="region"
          aria-label="도구 비교 표 (가로로 스크롤하여 더 많은 도구를 볼 수 있습니다)"
          tabIndex={0}
        >
          <table>
            <thead>
              <tr>
                <th>항목</th>
                {comparisonData.map((tool) => (
                  <th key={tool.id}>
                    <Link
                      to={`/details/${tool.id}`}
                      className="compare-tool-link"
                      aria-label={`${tool.name} 상세 보기`}
                    >
                      <img
                        src={tool.logo_url}
                        alt={tool.name}
                        className="table-logo"
                        loading="lazy"
                        onError={handleLogoError}
                      />
                      <span>{tool.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="label">카테고리</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>{tool.category}</td>
                ))}
              </tr>
              <tr>
                <td className="label">난이도</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    <span className={`difficulty ${tool.difficulty}`}>
                      <span className="difficulty-dot" aria-hidden="true">
                        {difficultyDot(tool.difficulty)}
                      </span>
                      {tool.difficulty}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">사용자 수</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {formatUserCount(tool.user_count) ?? '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">가격</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {tool.pricing?.length > 0 ? (
                      <div className="pricing-list">
                        {tool.pricing.map((price, idx) => (
                          <div key={idx} className="price-item">
                            <span className="plan">{price.plan}</span>
                            <span className="price">
                              {price.price === 0 ? '무료' : `$${price.price}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">벤치마크</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {tool.benchmarks && Object.keys(tool.benchmarks).length > 0 ? (
                      <div className="benchmark-list">
                        {Object.entries(tool.benchmarks).map(([type, score]) => (
                          <div key={type} className="benchmark-item">
                            <span className="type">{type}</span>
                            <span className="score">{score}/100</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="cell-coming-soon">준비 중</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">링크</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    <a href={tool.official_url} target="_blank" rel="noopener noreferrer" className="btn btn-small">
                      방문 →
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* 모바일 전용: 도구별 세로 카드 스택. 테이블 헤더가 사라지므로
            각 항목 라벨을 카드 안에 명시(접근성). CSS @media로 토글. */}
        <div className="comparison-cards" role="list">
          {comparisonData.map((tool) => (
            <article key={tool.id} className="comparison-card" role="listitem">
              <header className="comparison-card-header">
                <Link
                  to={`/details/${tool.id}`}
                  className="compare-tool-link"
                  aria-label={`${tool.name} 상세 보기`}
                >
                  <img
                    src={tool.logo_url}
                    alt={tool.name}
                    className="table-logo"
                    loading="lazy"
                    onError={handleLogoError}
                  />
                  <span className="comparison-card-name">{tool.name}</span>
                </Link>
              </header>

              <dl className="comparison-card-rows">
                <div className="comparison-card-row">
                  <dt>카테고리</dt>
                  <dd>{tool.category}</dd>
                </div>
                <div className="comparison-card-row">
                  <dt>난이도</dt>
                  <dd>
                    <span className={`difficulty ${tool.difficulty}`}>
                      <span className="difficulty-dot" aria-hidden="true">
                        {difficultyDot(tool.difficulty)}
                      </span>
                      {tool.difficulty}
                    </span>
                  </dd>
                </div>
                <div className="comparison-card-row">
                  <dt>사용자 수</dt>
                  <dd>{formatUserCount(tool.user_count) ?? '-'}</dd>
                </div>
                <div className="comparison-card-row">
                  <dt>가격</dt>
                  <dd>
                    {tool.pricing?.length > 0 ? (
                      <div className="pricing-list">
                        {tool.pricing.map((price, idx) => (
                          <div key={idx} className="price-item">
                            <span className="plan">{price.plan}</span>
                            <span className="price">
                              {price.price === 0 ? '무료' : `$${price.price}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div className="comparison-card-row">
                  <dt>벤치마크</dt>
                  <dd>
                    {tool.benchmarks &&
                    Object.keys(tool.benchmarks).length > 0 ? (
                      <div className="benchmark-list">
                        {Object.entries(tool.benchmarks).map(
                          ([type, score]) => (
                            <div key={type} className="benchmark-item">
                              <span className="type">{type}</span>
                              <span className="score">{score}/100</span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <span className="cell-coming-soon">준비 중</span>
                    )}
                  </dd>
                </div>
                <div className="comparison-card-row">
                  <dt>링크</dt>
                  <dd>
                    <a
                      href={tool.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-small"
                    >
                      방문 →
                    </a>
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        {/* 5개 미만이면 비교 화면 안에서 도구를 더 담는 동선 제공(과설계 X: 홈으로 안내). */}
        {selectedToolsForCompare.length < 5 && (
          <div className="compare-add-more" role="note">
            <p className="compare-add-more-text">
              최대 5개까지 비교할 수 있어요. 도구를 더 담아 비교해보세요.
            </p>
            <Link to="/" className="btn btn-small">
              홈에서 도구 더 담기 →
            </Link>
          </div>
        )}
        </>
      )}
    </div>
  );
};

export default Compare;
