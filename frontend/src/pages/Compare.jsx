import React, { useEffect } from 'react';
import { useUIStore } from '../stores/toolStore';
import { compareAPI, handleApiError } from '../services/api';
import {
  LoadingState,
  EmptyNoDataState,
  EmptyFilteredState,
  ErrorState,
} from '../components/states/StateViews';
import { SearchEmptyIcon } from '../components/states/StateIcons';
import '../styles/Compare.css';

const Compare = () => {
  const { selectedToolsForCompare, clearCompareList } = useUIStore();
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

  if (selectedToolsForCompare.length === 0) {
    return (
      <div className="compare-page">
        <EmptyNoDataState
          title="비교할 도구를 선택해주세요"
          message="홈에서 도구의 '비교' 버튼을 누르면 여기서 나란히 비교할 수 있어요."
          badge={null}
          icon={<SearchEmptyIcon />}
          ctaLabel="도구 탐색하기"
          ctaHref="/"
        />
      </div>
    );
  }

  return (
    <div className="compare-page">
      <div className="compare-header">
        <h1>⚖️ 도구 비교</h1>
        <p>{selectedToolsForCompare.length}개의 도구를 비교하고 있습니다</p>
        <button className="btn btn-secondary" onClick={clearCompareList}>
          초기화
        </button>
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
        </p>
      )}

      {!loading && !error && comparisonData && comparisonData.length > 0 && (
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
                    <img src={tool.logo_url} alt={tool.name} className="table-logo" />
                    <span>{tool.name}</span>
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
                      {tool.difficulty}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">사용자 수</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {tool.user_count ? `${(tool.user_count / 1000000).toFixed(1)}M+` : '-'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="label">가격</td>
                {comparisonData.map((tool) => (
                  <td key={tool.id}>
                    {tool.pricing.length > 0 ? (
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
                    {Object.keys(tool.benchmarks).length > 0 ? (
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
      )}
    </div>
  );
};

export default Compare;
