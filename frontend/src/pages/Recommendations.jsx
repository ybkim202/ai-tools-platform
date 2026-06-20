import React, { useState, useEffect, useCallback } from 'react';
import { recommendationsAPI, toolsAPI, handleApiError } from '../services/api';
import ToolCard from '../components/ToolCard';
import CompareTray from '../components/CompareTray';
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

  // 업무/직업 선택지는 실제 DB 태그에서 타입별로 분리해 채운다(하드코딩 목록 금지).
  // 업무별 탭 = data.tasks(task 타입), 직업별 탭 = data.professions(profession 타입).
  // 신규 필드가 없는 구 백엔드는 평면 meta.tags로 폴백(점진 배포 안전).
  const [optionsByType, setOptionsByType] = useState({ task: [], profession: [] });
  // 옵션(meta) 로드 상태: 0건 복구 동선("다시 시도") 구분용.
  // 'loading' | 'ready' | 'error'
  const [optionsStatus, setOptionsStatus] = useState('loading');

  // 현재 탭에 해당하는 옵션 목록만 노출.
  const options = optionsByType[selectedTab] || [];

  // 결과(로딩→카드)가 선택 영역 아래·폴드 밖에 렌더될 수 있어, 선택 직후 이 앵커로
  // 스크롤해 피드백을 보이게 한다(Home 페이지네이션 scrollIntoView 패턴 재사용).
  const resultsAnchorRef = React.useRef(null);

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
        // 신규 필드(tasks/professions)가 있으면 타입별로, 없으면 평면 tags로 폴백.
        const flat = Array.isArray(data.tags) ? data.tags : [];
        setOptionsByType({
          task: Array.isArray(tasks) ? tasks : flat,
          profession: Array.isArray(professions) ? professions : flat,
        });
        setOptionsStatus('ready');
      })
      .catch(() => {
        // 메타 로드 실패: 옵션 없음 + 복구 동선("다시 시도") 노출.
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
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value) => {
    setSelectedValue(value);
    fetchRecommendations(selectedTab, value);
    // 다음 프레임에 결과 앵커로 이동(로딩/결과가 폴드 밖이어도 피드백이 보이게).
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
        <p className="page-subtitle">당신의 업무 또는 직업에 맞춰 AI 도구를 추천받으세요</p>
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
            // meta 로드 실패로 옵션 0건: 침묵하지 않고 재시도 동선 제공.
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

      {/* 스크롤 타깃: 선택 직후 이 지점으로 이동해 로딩/결과가 보이게 한다(피드백 근접성). */}
      <div ref={resultsAnchorRef} aria-hidden="true" />

      {loading && <LoadingState message="추천을 불러오는 중..." />}

      {!loading && error && (
        <ErrorState message={error?.message} errorId={error?.errorId} onRetry={handleRetry} />
      )}

      {!loading && !error && recommendations.length > 0 && (
        <div className="results-section" role="region" aria-live="polite">
          {/* 비교 트레이(F4): 추천 카드 담기 → 동일 트레이 노출 → 선택 유지한 채 /compare 이동 */}
          <CompareTray />
          <h2 className="results-heading">
            <span className="results-context">'{selectedValue}'</span>
            에게 추천하는 도구 {recommendations.length}개
          </h2>
          {/* 추천 근거 폴백(#11): 백엔드가 matched_tags를 주면 카드별 근거 칩이 뜬다.
              근거가 "전부" 비어 있을 때만(every) 결과 영역에 맥락 라벨을 한 줄 둔다.
              일부 카드에만 칩이 있으면 상단 라벨을 띄우지 않는다 — 개별 근거 칩과
              일반 라벨이 동시에 떠 "어느 게 진짜 근거냐"는 이중 메시지가 되는 것을 막는다. */}
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
                  // 백엔드가 실제 매칭 태그를 줄 때만 근거 표시.
                  // matched_tags가 없으면 선택값으로 대체하지 않는다(동어반복=허위 근거 방지).
                  Array.isArray(tool.matched_tags) && tool.matched_tags.length > 0
                    ? tool.matched_tags
                    : undefined
                }
              />
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
            ctaTo="/"
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
