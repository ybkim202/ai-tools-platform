import React, { useState, useEffect } from 'react';
import { recommendationsAPI, toolsAPI, handleApiError } from '../services/api';
import ToolCard from '../components/ToolCard';
import {
  LoadingState,
  EmptyFilteredState,
  EmptyNoDataState,
  ErrorState,
} from '../components/states/StateViews';
import '../styles/Recommendations.css';

const Recommendations = () => {
  const [recommendations, setRecommendations] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [selectedTab, setSelectedTab] = useState('task');
  const [selectedValue, setSelectedValue] = useState('');
  // 'ready' | 'coming_soon' — 0건 시 EmptyFiltered vs EmptyNoData 판별.
  const [featureStatus, setFeatureStatus] = useState('ready');

  // 업무/직업 선택지는 실제 DB 태그(meta.tags)에서 채운다(하드코딩 목록 금지).
  // task/profession 모두 태그를 옵션 소스로 사용. 로드 실패 시 빈 목록 폴백.
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let active = true;
    toolsAPI
      .getMeta()
      .then((res) => {
        if (!active) return;
        const tags = res?.data?.data?.tags;
        if (Array.isArray(tags) && tags.length > 0) {
          setOptions(tags);
        }
      })
      .catch(() => {
        // 메타 로드 실패: 옵션 없음(아래 빈 상태 안내로 처리).
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchRecommendations = async (type, value) => {
    setLoading(true);
    setError(null);
    try {
      const response = await recommendationsAPI.getRecommendations(
        type === 'task' ? value : null,
        type === 'profession' ? value : null,
        20
      );
      const data = response.data?.data || [];
      // 1순위: 백엔드 meta.feature_status. 폴백: 태그 데이터 미적재 추론은
      // 서버 신호가 없으면 'ready'로 두고 EmptyFiltered로 처리(보수적).
      const status = response.data?.meta?.feature_status || 'ready';
      setFeatureStatus(status);
      setRecommendations(data);
    } catch (err) {
      const apiError = handleApiError(err);
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value) => {
    setSelectedValue(value);
    fetchRecommendations(selectedTab, value);
  };

  const handleReset = () => {
    setSelectedValue('');
    setRecommendations([]);
    setError(null);
  };

  // 탭 전환 시 이전 결과/선택/에러를 초기화해 위계가 섞이지 않게 한다.
  const handleTabChange = (tab) => {
    if (tab === selectedTab) return;
    setSelectedTab(tab);
    setSelectedValue('');
    setRecommendations([]);
    setError(null);
    setFeatureStatus('ready');
  };

  const handleRetry = () => {
    if (selectedValue) fetchRecommendations(selectedTab, selectedValue);
  };

  return (
    <div className="recommendations-page">
      <div className="page-header">
        <p className="page-eyebrow">맞춤 추천</p>
        <h1 className="page-title">나에게 맞는 AI 도구</h1>
        <p className="page-subtitle">당신의 업무와 직업에 맞는 AI 도구를 추천받으세요</p>
      </div>

      <div className="recommendation-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'task'}
          className={`tab ${selectedTab === 'task' ? 'active' : ''}`}
          onClick={() => handleTabChange('task')}
        >
          업무별
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === 'profession'}
          className={`tab ${selectedTab === 'profession' ? 'active' : ''}`}
          onClick={() => handleTabChange('profession')}
        >
          직업별
        </button>
      </div>

      <div className="selection-area">
        <div className="options">
          <h3>{selectedTab === 'task' ? '업무를 선택하세요' : '직업을 선택하세요'}</h3>
          {options.length > 0 ? (
            <div className="option-grid">
              {options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={selectedValue === opt}
                  className={`option-btn ${selectedValue === opt ? 'active' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <p className="state-message" role="status">
              선택지를 불러오는 중이거나 준비된 분류가 없습니다.
            </p>
          )}
        </div>
      </div>

      {loading && <LoadingState message="추천을 불러오는 중..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={handleRetry} />
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="results-section" role="region" aria-live="polite">
          <h2>추천 결과</h2>
          <div className="tools-grid">
            {recommendations.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {/* 선택했는데 0건: 태그 미적재(NoData) vs 해당 선택만 0건(Filtered) 분기 */}
      {!loading && !error && selectedValue && recommendations.length === 0 && (
        featureStatus === 'coming_soon' ? (
          <EmptyNoDataState
            message="추천에 필요한 도구 분류 데이터를 준비하고 있어요."
            ctaLabel="도구 탐색하기"
            ctaHref="/"
          />
        ) : (
          <EmptyFilteredState
            message={
              selectedTab === 'task'
                ? '다른 업무를 선택해보세요'
                : '다른 직업을 선택해보세요'
            }
            onReset={handleReset}
            resetLabel="선택 초기화"
          />
        )
      )}

      {/* 초기 진입: 안내 헬퍼 */}
      {!loading && !error && !selectedValue && (
        <div className="state-container" role="status">
          <p className="state-message">
            업무 또는 직업을 선택하면 추천이 표시됩니다
          </p>
        </div>
      )}
    </div>
  );
};

export default Recommendations;
