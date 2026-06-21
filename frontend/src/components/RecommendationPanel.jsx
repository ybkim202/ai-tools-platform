import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { recommendationsAPI, toolsAPI, handleApiError } from '../services/api';
import ToolCard from './ToolCard';
import CompareTray from './CompareTray';
import {
  LoadingState,
  EmptyFilteredState,
  EmptyNoDataState,
  ErrorState,
} from './states/StateViews';
import '../styles/Recommendations.css';

// 맞춤 추천 패널 — 랜딩(/#recommend)에 임베드한다(IA 재설계 §9, 독립 페이지 은퇴).
// 직무(profession)/업무(task) 토글 + DB 메타 옵션 + 매칭 결과(ToolCard reasonTags).
// 딥링크 ?type=&value= 와 #recommend 해시로 진입하면 자동 선택 + 패널로 스크롤한다.
const RecommendationPanel = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('task');
  const [selectedValue, setSelectedValue] = useState('');
  const [featureStatus, setFeatureStatus] = useState('ready');
  const [optionsByType, setOptionsByType] = useState({ task: [], profession: [] });
  const [optionsStatus, setOptionsStatus] = useState('loading');

  const [searchParams] = useSearchParams();
  const location = useLocation();
  const options = optionsByType[selectedTab] || [];

  const sectionRef = useRef(null);
  const resultsAnchorRef = useRef(null);

  const scrollToPanel = useCallback(() => {
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const loadOptions = useCallback(() => {
    let active = true;
    setOptionsStatus('loading');
    toolsAPI
      .getMeta()
      .then((res) => {
        if (!active) return;
        const data = res?.data?.data || {};
        const tasks = data.tasks;
        const professions = data.professions;
        const flat = Array.isArray(data.tags) ? data.tags : [];
        setOptionsByType({
          task: Array.isArray(tasks) ? tasks : flat,
          profession: Array.isArray(professions) ? professions : flat,
        });
        setOptionsStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setOptionsByType({ task: [], profession: [] });
        setOptionsStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadOptions();
    return cleanup;
  }, [loadOptions]);

  const fetchRecommendations = useCallback(async (type, value) => {
    setLoading(true);
    setError(null);
    try {
      const response = await recommendationsAPI.getRecommendations(
        type === 'task' ? value : null,
        type === 'profession' ? value : null,
        20
      );
      const data = response.data?.data || [];
      const status = response.data?.meta?.feature_status || 'ready';
      setFeatureStatus(status);
      setRecommendations(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // 딥링크 진입(Home 용도 칩 / 구 /recommendations 리다이렉트): ?type=&value=
  // → 탭/값 선택 + 1회 조회. 옵션 로드 후 한 번만(중복 fetch 방지).
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || optionsStatus !== 'ready') return;
    const type = searchParams.get('type');
    const value = searchParams.get('value');
    if ((type === 'task' || type === 'profession') && value) {
      deepLinkApplied.current = true;
      setSelectedTab(type);
      setSelectedValue(value);
      fetchRecommendations(type, value);
    }
  }, [optionsStatus, searchParams, fetchRecommendations]);

  // #recommend 해시로 진입/이동할 때마다 패널로 스크롤(나브 '추천'·칩·리다이렉트).
  // location.key 를 deps 에 둬 같은 해시를 다시 눌러도 재스크롤된다.
  useEffect(() => {
    if (location.hash === '#recommend') scrollToPanel();
  }, [location.hash, location.key, scrollToPanel]);

  const handleSelect = (value) => {
    setSelectedValue(value);
    fetchRecommendations(selectedTab, value);
    requestAnimationFrame(() => {
      resultsAnchorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleReset = () => {
    setSelectedValue('');
    setRecommendations([]);
    setError(null);
  };

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
    <section
      className="recommend-panel"
      id="recommend"
      ref={sectionRef}
      aria-labelledby="recommend-title"
    >
      <div className="recommend-panel-header">
        <h2 id="recommend-title" className="recommend-panel-title">
          맞춤 추천
        </h2>
        <p className="recommend-panel-subtitle">
          업무 또는 직업을 고르면 그에 맞는 AI 도구를 추천해드려요
        </p>
      </div>

      <div className="recommendation-tabs" role="tablist" aria-label="추천 기준">
        <button
          type="button"
          role="tab"
          id="rec-tab-task"
          aria-selected={selectedTab === 'task'}
          aria-controls="rec-tabpanel"
          className={`tab ${selectedTab === 'task' ? 'active' : ''}`}
          onClick={() => handleTabChange('task')}
        >
          업무별
        </button>
        <button
          type="button"
          role="tab"
          id="rec-tab-profession"
          aria-selected={selectedTab === 'profession'}
          aria-controls="rec-tabpanel"
          className={`tab ${selectedTab === 'profession' ? 'active' : ''}`}
          onClick={() => handleTabChange('profession')}
        >
          직업별
        </button>
      </div>

      <div
        className="selection-area"
        role="tabpanel"
        id="rec-tabpanel"
        aria-labelledby={
          selectedTab === 'task' ? 'rec-tab-task' : 'rec-tab-profession'
        }
      >
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
          ) : optionsStatus === 'loading' ? (
            <LoadingState message="선택지를 불러오는 중..." />
          ) : optionsStatus === 'error' ? (
            <ErrorState
              title="선택지를 불러오지 못했습니다"
              message="네트워크를 확인한 뒤 다시 시도해주세요."
              onRetry={loadOptions}
            />
          ) : (
            <p className="state-message" role="status">
              준비된 분류가 아직 없습니다.
            </p>
          )}
        </div>
      </div>

      <div ref={resultsAnchorRef} aria-hidden="true" />

      {loading && <LoadingState message="추천을 불러오는 중..." />}

      {!loading && error && (
        <ErrorState
          message={error?.message}
          errorId={error?.errorId}
          onRetry={handleRetry}
        />
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="results-section" role="region" aria-live="polite">
          <CompareTray />
          <h3 className="results-heading">
            <span className="results-context">'{selectedValue}'</span>
            에게 추천하는 도구 {recommendations.length}개
          </h3>
          {recommendations.every(
            (tool) =>
              !Array.isArray(tool.matched_tags) || tool.matched_tags.length === 0
          ) && (
            <p className="results-basis">
              <span className="results-context">'{selectedValue}'</span>
              {selectedTab === 'task' ? ' 업무' : ' 직업'} 기준으로 선별한 추천이에요
            </p>
          )}
          <div className="tools-grid">
            {recommendations.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                reasonTags={
                  Array.isArray(tool.matched_tags) && tool.matched_tags.length > 0
                    ? tool.matched_tags
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && selectedValue && recommendations.length === 0 && (
        featureStatus === 'coming_soon' ? (
          <EmptyNoDataState
            message="추천에 필요한 도구 분류 데이터를 준비하고 있어요."
            ctaLabel="전체 도구 탐색"
            ctaTo="/explore"
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

      {!loading && !error && !selectedValue && (
        <div className="state-container" role="status">
          <p className="state-message">
            업무 또는 직업을 선택하면 추천이 표시됩니다
          </p>
        </div>
      )}
    </section>
  );
};

export default RecommendationPanel;
