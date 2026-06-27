import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { recommendationsAPI, toolsAPI, handleApiError } from '../services/api';
import ToolCard from './ToolCard';
import {
  LoadingState,
  EmptyFilteredState,
  EmptyNoDataState,
  ErrorState,
} from './states/StateViews';
import { REC_ICON_PATHS, REC_FALLBACK_ICON } from '../utils/categoryMeta';
import '../styles/Recommendations.css';

// 업무/직업 칩 라인 아이콘 — 무채색(currentColor).
const RecIcon = ({ value }) => (
  <svg
    className="option-btn-icon"
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={REC_ICON_PATHS[value] || REC_FALLBACK_ICON} />
  </svg>
);

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
  const carouselRef = useRef(null);

  // 카루셀 좌우 이동: 보이는 폭의 80%만큼 부드럽게 스크롤(스냅으로 카드에 정렬).
  const scrollCarousel = useCallback((dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }, []);

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

  // 기본 선택(요청): 옵션 로드 후 선택값이 없으면 현재 탭의 첫 옵션을 자동 선택+조회.
  // 탭 전환 시(selectedValue 비워짐)에도 해당 탭 첫 옵션으로 채운다. 단, 딥링크가
  // 처리할 케이스(?type=&value=)면 양보(중복/경합 방지). 초기 로드라 스크롤은 안 한다.
  useEffect(() => {
    if (optionsStatus !== 'ready' || selectedValue) return;
    const dlType = searchParams.get('type');
    const dlValue = searchParams.get('value');
    if (dlType && dlValue && !deepLinkApplied.current) return;
    const opts = optionsByType[selectedTab] || [];
    if (opts.length === 0) return;
    setSelectedValue(opts[0]);
    fetchRecommendations(selectedTab, opts[0]);
  }, [
    optionsStatus,
    selectedValue,
    selectedTab,
    optionsByType,
    searchParams,
    fetchRecommendations,
  ]);

  // #recommend 해시로 진입/이동할 때마다 패널로 스크롤(나브 '추천'·칩·리다이렉트).
  // location.key 를 deps 에 둬 같은 해시를 다시 눌러도 재스크롤된다.
  useEffect(() => {
    if (location.hash === '#recommend') scrollToPanel();
  }, [location.hash, location.key, scrollToPanel]);

  const handleSelect = (value) => {
    // 칩 선택 시 화면 이동 없음(요청) — 결과만 갱신, 스크롤하지 않는다.
    setSelectedValue(value);
    fetchRecommendations(selectedTab, value);
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

  // 업무별 ⇄ 직업별 단일 토글(기본 업무별). 누를 때마다 반대 기준으로 전환.
  const toggleMode = () =>
    handleTabChange(selectedTab === 'task' ? 'profession' : 'task');

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

      <div
        className="selection-area"
        role="group"
        aria-label="추천 분류 선택"
      >
        <div className="options">
          {options.length > 0 ? (
            <div className="rec-controls">
              {/* 업무별/직업별 단일 토글 — 칩 좌측. 기본 업무별, 클릭 시 직업별로 전환. */}
              <button
                type="button"
                className="rec-mode-toggle"
                onClick={toggleMode}
                aria-label={`현재 ${
                  selectedTab === 'task' ? '업무별' : '직업별'
                } 추천 — 눌러서 ${
                  selectedTab === 'task' ? '직업별' : '업무별'
                }로 전환`}
              >
                <span className="rec-mode-label">
                  {selectedTab === 'task' ? '업무별' : '직업별'}
                </span>
                <svg
                  className="rec-mode-swap"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" />
                </svg>
              </button>

              {/* 칩 — 토글 우측, 좌측 정렬. 각 업무/직업에 아이콘 동반. */}
              <div className="option-chips">
                {options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={selectedValue === opt}
                    className={`option-btn ${selectedValue === opt ? 'active' : ''}`}
                    onClick={() => handleSelect(opt)}
                  >
                    <RecIcon value={opt} />
                    {opt}
                  </button>
                ))}
              </div>
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
          <div className="results-head-row">
            <h3 className="results-heading">
              <span className="results-context">'{selectedValue}'</span>
              에게 추천하는 도구 {recommendations.length}개
            </h3>
            {/* 카루셀 좌우 이동(데스크톱). 모바일은 스와이프 — CSS로 숨김. */}
            <div className="rec-carousel-nav" aria-hidden="true">
              <button
                type="button"
                className="rec-carousel-btn"
                aria-label="이전 도구 보기"
                onClick={() => scrollCarousel(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="rec-carousel-btn"
                aria-label="다음 도구 보기"
                onClick={() => scrollCarousel(1)}
              >
                ›
              </button>
            </div>
          </div>
          {recommendations.every(
            (tool) =>
              !Array.isArray(tool.matched_tags) || tool.matched_tags.length === 0
          ) && (
            <p className="results-basis">
              <span className="results-context">'{selectedValue}'</span>
              {selectedTab === 'task' ? ' 업무' : ' 직업'} 기준으로 선별한 추천이에요
            </p>
          )}
          {/* 가로 슬라이드(scroll-snap). 네이티브 스크롤이라 키보드·터치 접근성 유지.
              래퍼 양옆에 배경색 그라데이션 + 흐림 마스크 오버레이로 가장자리 카드를 페이드. */}
          <div className="rec-carousel-wrap">
            <ul className="rec-carousel" ref={carouselRef}>
              {recommendations.map((tool) => (
                <li key={tool.id} className="rec-carousel-item">
                  <ToolCard
                    tool={tool}
                    reasonTags={
                      Array.isArray(tool.matched_tags) &&
                      tool.matched_tags.length > 0
                        ? tool.matched_tags
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
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
