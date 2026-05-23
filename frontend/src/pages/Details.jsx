import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToolStore } from '../stores/toolStore';
import { benchmarksAPI, newsAPI } from '../services/api';
import '../styles/Details.css';

const Details = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchToolDetail, selectedTool, loading } = useToolStore();
  const [benchmarks, setBenchmarks] = React.useState(null);
  const [news, setNews] = React.useState(null);

  const fetchBenchmarksAndNews = React.useCallback(async () => {
    try {
      const benchRes = await benchmarksAPI.getBenchmarkSummary(id);
      setBenchmarks(benchRes.data.data);
      
      const newsRes = await newsAPI.getToolNews(id, 5);
      setNews(newsRes.data.data);
    } catch (err) {
      console.error('Error fetching details:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchToolDetail(id);
    fetchBenchmarksAndNews();
  }, [id, fetchToolDetail, fetchBenchmarksAndNews]);

  if (loading) return <div className="loading">로딩 중...</div>;
  if (!selectedTool) return <div className="error">도구를 찾을 수 없습니다</div>;

  return (
    <div className="details-page">
      <button className="back-btn" onClick={() => navigate('/')}>
        ← 뒤로가기
      </button>

      <div className="details-header">
        <img src={selectedTool.logo_url} alt={selectedTool.name} className="logo" />
        <div className="header-info">
          <h1>{selectedTool.name}</h1>
          <p className="description">{selectedTool.description}</p>
          <div className="meta">
            <span className="category">{selectedTool.category}</span>
            <span className="country">{selectedTool.country}</span>
            <span className="difficulty">{selectedTool.difficulty}</span>
          </div>
          <a href={selectedTool.official_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            공식 사이트 방문 →
          </a>
        </div>
      </div>

      <div className="details-content">
        {/* 가격 */}
        {selectedTool.pricing && selectedTool.pricing.length > 0 && (
          <section className="pricing-section">
            <h2>💰 가격</h2>
            <div className="pricing-grid">
              {selectedTool.pricing.map((price) => (
                <div key={price.id} className="pricing-card">
                  <h3>{price.plan_name}</h3>
                  <div className="price">
                    {price.price === 0 ? '무료' : `$${price.price}/${price.billing_period}`}
                  </div>
                  <p>{price.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 벤치마크 */}
        {benchmarks && Object.keys(benchmarks.benchmarks).length > 0 && (
          <section className="benchmark-section">
            <h2>📊 성능 벤치마크</h2>
            <div className="benchmark-grid">
              {Object.entries(benchmarks.benchmarks).map(([type, data]) => (
                <div key={type} className="benchmark-card">
                  <h3>{type}</h3>
                  <div className="score">{data.score}/100</div>
                  <p className="source">{data.source}</p>
                </div>
              ))}
            </div>
            <p className="average">평균 점수: {benchmarks.average_score}/100</p>
          </section>
        )}

        {/* 뉴스 */}
        {news && news.length > 0 && (
          <section className="news-section">
            <h2>📰 최신 뉴스</h2>
            <div className="news-list">
              {news.map((item) => (
                <div key={item.id} className="news-card">
                  <h3>{item.title}</h3>
                  <p>{item.content}</p>
                  {item.source_url && (
                    <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="source-link">
                      원문 보기 →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Details;
