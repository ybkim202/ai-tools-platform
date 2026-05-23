import React, { useEffect } from 'react';
import { useUIStore } from '../stores/toolStore';
import { compareAPI, handleApiError } from '../services/api';
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
      setComparisonData(response.data.comparison);
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
      <div className="compare-empty">
        <div className="empty-content">
          <h2>⚖️ 도구를 선택해주세요</h2>
          <p>홈페이지에서 도구의 '비교' 버튼을 클릭하면 여기서 비교할 수 있습니다!</p>
          <a href="/" className="btn btn-primary">
            홈으로 돌아가기
          </a>
        </div>
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

      {loading && <div className="loading">로딩 중...</div>}
      {error && <div className="error">{error}</div>}

      {comparisonData && (
        <div className="comparison-table">
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
                      '-'
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
