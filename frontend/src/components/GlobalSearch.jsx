import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useUIStore } from '../stores/toolStore';
import { toolsAPI, handleApiError } from '../services/api';
import { handleLogoError, resolveLogoSrc } from '../utils/logoFallback';
import '../styles/GlobalSearch.css';

// 검색 디바운스(ms): News 패턴과 동일.
const SEARCH_DEBOUNCE_MS = 300;
// 최소 글자 수: 2글자 이상일 때만 요청.
const MIN_QUERY_LEN = 2;
// 드롭다운 결과 최대 노출 수.
const RESULT_LIMIT = 6;

/**
 * GlobalSearch (F3) — 헤더 타입어헤드.
 * 어느 화면에서나 도구를 즉시 찾는다. 검색 로직은 News 디바운스(300ms),
 * 키보드/aria는 TrendNav(App.js) combobox 패턴 답습.
 * 서버 호출은 services/api.js(toolsAPI.searchTools) 경유.
 */
const GlobalSearch = () => {
  const navigate = useNavigate();

  // 모바일 검색 오버레이 노출은 store enum에서 파생(햄버거와 상호배타).
  const activeHeaderPanel = useUIStore((state) => state.activeHeaderPanel);
  const toggleHeaderPanel = useUIStore((state) => state.toggleHeaderPanel);
  const closeHeaderPanel = useUIStore((state) => state.closeHeaderPanel);
  const mobileOpen = activeHeaderPanel === 'search';

  // 입력값(즉시) vs 요청용(디바운스).
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  // roving 가상 포커스 인덱스(-1 = 입력에 포커스).
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const itemRefs = useRef([]);
  // 모바일 오버레이가 직전에 열려 있었는지 추적(닫힘 전환 감지용).
  const wasMobileOpenRef = useRef(false);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // 에러 상태에서 동일 검색어로 재요청(입력 변경 없이도 복구 가능하게).
  const retrySearch = useCallback(() => {
    setStatus('loading');
    setRetryNonce((n) => n + 1);
  }, []);

  // 디바운스: 입력 멈춤 후 요청용 값 갱신.
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery((prev) => (prev === query ? prev : query));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  // 수동 재시도 트리거(에러 상태에서 동일 검색어로 재요청).
  const [retryNonce, setRetryNonce] = useState(0);

  // 요청: 2글자 이상일 때만. 그 외엔 드롭다운 닫고 결과 비움.
  useEffect(() => {
    const term = debouncedQuery.trim();
    if (term.length < MIN_QUERY_LEN) {
      setResults([]);
      setStatus('idle');
      setOpen(false);
      setActiveIndex(-1);
      return undefined;
    }
    let active = true;
    setStatus('loading');
    setOpen(true);
    toolsAPI
      .searchTools(term, { limit: RESULT_LIMIT })
      .then((res) => {
        if (!active) return;
        const data = res?.data?.data;
        setResults(Array.isArray(data) ? data : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        // 색 단독 의미 금지 → 텍스트로만 에러 안내. 메시지는 handleApiError 활용.
        handleApiError(err);
        setResults([]);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [debouncedQuery, retryNonce]);

  // 모바일 검색 오버레이가 닫힐 때(메뉴 전환/Esc/바깥클릭 등으로 'search'→그 외)
  // 입력값·결과·드롭다운을 초기화해 다음 진입 시 이전 쿼리/결과 잔상을 제거한다.
  // 데스크톱(인라인, activeHeaderPanel은 줄곧 'none')에서는 닫힘 전환이 없어 영향 없음.
  useEffect(() => {
    if (wasMobileOpenRef.current && !mobileOpen) {
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setStatus('idle');
      setOpen(false);
      setActiveIndex(-1);
    }
    wasMobileOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  // 바깥 클릭 닫기(TrendNav mousedown 패턴).
  useEffect(() => {
    if (!open && !mobileOpen) return undefined;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
        closeHeaderPanel();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, mobileOpen, closeDropdown, closeHeaderPanel]);

  const goToTool = (toolId) => {
    closeDropdown();
    closeHeaderPanel();
    setQuery('');
    navigate(`/details/${toolId}`);
  };

  const goToAllResults = () => {
    const term = query.trim();
    closeDropdown();
    closeHeaderPanel();
    navigate(`/?search=${encodeURIComponent(term)}`);
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      setOpen(true);
      const next = activeIndex < results.length - 1 ? activeIndex + 1 : 0;
      setActiveIndex(next);
      requestAnimationFrame(() => itemRefs.current[next]?.focus());
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      const prev = activeIndex > 0 ? activeIndex - 1 : results.length - 1;
      setActiveIndex(prev);
      requestAnimationFrame(() => itemRefs.current[prev]?.focus());
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        goToTool(results[activeIndex].id);
      } else if (query.trim().length > 0) {
        goToAllResults();
      }
    } else if (e.key === 'Escape') {
      // 드롭다운이 열려 있으면 먼저 닫고, 닫힌 상태면 모바일 오버레이를 닫는다.
      if (open) {
        closeDropdown();
        inputRef.current?.focus();
      } else {
        closeHeaderPanel();
        // 닫은 뒤 포커스를 토글 버튼으로 복귀(키보드 흐름 유지).
        toggleRef.current?.focus();
      }
    }
  };

  const onItemKeyDown = (e, idx) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % results.length;
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + results.length) % results.length;
      setActiveIndex(prev);
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      goToTool(results[idx].id);
    } else if (e.key === 'Escape') {
      closeDropdown();
      inputRef.current?.focus();
    }
  };

  const term = debouncedQuery.trim();
  const showDropdown = open && term.length >= MIN_QUERY_LEN;
  const activeDescendant =
    activeIndex >= 0 && results[activeIndex]
      ? `gs-opt-${results[activeIndex].id}`
      : undefined;

  const resultCountLabel =
    status === 'ready' ? `검색 결과 ${results.length}개` : '';

  const searchField = (
    <div className="global-search-field">
      <svg
        className="global-search-icon"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zm4.5-4.5l3.5 3.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        ref={inputRef}
        type="text"
        className="search-input global-search-input"
        placeholder="도구 검색..."
        aria-label="도구 검색"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={activeDescendant}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={onInputKeyDown}
      />

      {showDropdown && (
        <div
          id="global-search-listbox"
          className="global-search-dropdown"
          role="listbox"
          aria-busy={status === 'loading'}
        >
          {status === 'loading' && (
            <p className="global-search-status">검색 중...</p>
          )}

          {status === 'error' && (
            <div className="global-search-status">
              <p>검색을 불러올 수 없습니다</p>
              <button
                type="button"
                className="global-search-allbtn"
                onClick={retrySearch}
              >
                다시 시도 →
              </button>
            </div>
          )}

          {status === 'ready' && results.length === 0 && (
            <div className="global-search-status">
              <p>'{term}'에 대한 결과가 없습니다</p>
              <button
                type="button"
                className="global-search-allbtn"
                onClick={goToAllResults}
              >
                전체에서 검색 →
              </button>
            </div>
          )}

          {status === 'ready' &&
            results.map((tool, idx) => (
              <button
                key={tool.id}
                type="button"
                id={`gs-opt-${tool.id}`}
                role="option"
                aria-selected={activeIndex === idx}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                className={`global-search-option${
                  activeIndex === idx ? ' active' : ''
                }`}
                onClick={() => goToTool(tool.id)}
                onKeyDown={(e) => onItemKeyDown(e, idx)}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <img
                  src={resolveLogoSrc(tool.logo_url, tool.name)}
                  alt=""
                  className="global-search-logo"
                  loading="lazy"
                  onError={handleLogoError}
                />
                <span className="global-search-option-text">
                  <span className="global-search-option-name">
                    {tool.name}
                  </span>
                  {tool.category && (
                    <span className="global-search-option-cat">
                      {tool.category}
                    </span>
                  )}
                </span>
              </button>
            ))}

          {status === 'ready' && results.length >= RESULT_LIMIT && (
            <p className="global-search-hint">Enter로 전체 결과 보기</p>
          )}
        </div>
      )}

      {/* 스크린리더용 결과 수 안내(시각 숨김) */}
      <span className="sr-only" aria-live="polite">
        {resultCountLabel}
      </span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`global-search${mobileOpen ? ' global-search-mobile-open' : ''}`}
    >
      {/* 모바일 전용 아이콘 토글(데스크톱은 CSS로 숨김). */}
      <button
        type="button"
        ref={toggleRef}
        className="global-search-toggle"
        aria-label={mobileOpen ? '검색 닫기' : '검색 열기'}
        aria-expanded={mobileOpen}
        onClick={() => {
          const willOpen = activeHeaderPanel !== 'search';
          toggleHeaderPanel('search');
          // 검색을 열 때(메뉴가 열려 있었다면 자동 닫힘) 입력으로 포커스 이동.
          if (willOpen) {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        <span aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zm4.5-4.5l3.5 3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </button>

      {/* 데스크톱: 인라인. 모바일: 토글 시 헤더 하단 풀폭 오버레이. */}
      <div className="global-search-panel">{searchField}</div>
    </div>
  );
};

export default GlobalSearch;
