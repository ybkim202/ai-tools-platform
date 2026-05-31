import { create } from 'zustand';
import { toolsAPI, recommendationsAPI, handleApiError } from '../services/api';

// ==================== Tools Store ====================
export const useToolStore = create((set, get) => ({
  // 상태
  tools: [],
  selectedTool: null,
  loading: false,
  error: null,
  detailError: null,
  pagination: {
    total: 0,
    limit: 20,
    offset: 0,
    pages: 0,
  },
  // 정렬은 Home의 로컬 state(클라이언트 파생)로 처리하므로 store에 두지 않는다.
  // (과거 sort_by 필드는 아무도 읽지 않는 잔재라 제거 — G8 잔재 정리.)
  filters: {
    search: '',
    category: null,
    country: null,
    difficulty: null,
  },

  // 액션
  // 도구 목록 조회
  fetchTools: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await toolsAPI.getTools(params);
      set({
        tools: response.data.data,
        pagination: response.data.pagination,
        loading: false,
      });
    } catch (err) {
      const error = handleApiError(err);
      set({ error: error.message, loading: false });
    }
  },

  // 도구 상세 조회
  fetchToolDetail: async (toolId) => {
    set({ loading: true, error: null, detailError: null, selectedTool: null });
    try {
      const response = await toolsAPI.getToolDetail(toolId);
      set({
        selectedTool: response.data.data,
        loading: false,
      });
    } catch (err) {
      const error = handleApiError(err);
      // 404(찾을 수 없음)는 빈상태로, 그 외(네트워크/5xx)는 detailError로 분리.
      const isNotFound = error.status === 404;
      set({
        detailError: isNotFound ? null : error.message,
        selectedTool: null,
        loading: false,
      });
    }
  },

  // 도구 검색
  searchTools: async (searchQuery, params = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await toolsAPI.searchTools(searchQuery, params);
      set({
        tools: response.data.data,
        pagination: response.data.pagination,
        filters: { ...get().filters, search: searchQuery },
        loading: false,
      });
    } catch (err) {
      const error = handleApiError(err);
      set({ error: error.message, loading: false });
    }
  },

  // 필터 업데이트
  updateFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  // 페이지 변경
  setPage: (newOffset) => {
    set((state) => ({
      pagination: { ...state.pagination, offset: newOffset },
    }));
  },

  // 에러 초기화
  clearError: () => set({ error: null }),

  // 선택 도구 초기화
  clearSelectedTool: () => set({ selectedTool: null }),
}));

// ==================== Recommendations Store ====================
export const useRecommendationStore = create((set) => ({
  // 상태
  recommendations: [],
  loading: false,
  error: null,
  query: {
    task: null,
    profession: null,
  },

  // 액션
  fetchRecommendations: async (task = null, profession = null, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const response = await recommendationsAPI.getRecommendations(task, profession, limit);
      set({
        recommendations: response.data.data,
        query: { task, profession },
        loading: false,
      });
    } catch (err) {
      const error = handleApiError(err);
      set({ error: error.message, loading: false });
    }
  },

  // 에러 초기화
  clearError: () => set({ error: null }),
}));

// ==================== UI Store ====================
// 다크모드 3-상태 모델: 'light' | 'dark' | null(시스템 따름).
// localStorage에 명시값이 있으면 사용, 없으면 null(=OS prefers 따름).
// localStorage 접근 가드: Safari 프라이빗 모드/SSR 등에서 throw 시 앱 부팅 실패 방지.
const readStoredTheme = () => {
  try {
    const stored = window.localStorage.getItem('theme');
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
};

// 쓰기 실패(QuotaExceeded/프라이빗 모드 등)는 무시하고 메모리 상태만 갱신.
const writeStoredTheme = (value) => {
  try {
    window.localStorage.setItem('theme', value);
  } catch {
    /* no-op: 영속화 실패해도 세션 내 동작은 유지 */
  }
};

// 비교 선택은 새로고침 후에도 동선이 유지되도록 sessionStorage에 영속화한다.
// (탭 범위 한정: 탭 닫으면 초기화 — 장기 영속 불필요.) 접근 실패는 가드.
const COMPARE_STORAGE_KEY = 'compareSelection';
const MAX_COMPARE = 5;

const readStoredCompare = () => {
  try {
    const raw = window.sessionStorage.getItem(COMPARE_STORAGE_KEY);
    if (!raw) return { ids: [], names: {} };
    const parsed = JSON.parse(raw);
    const ids = Array.isArray(parsed?.ids)
      ? parsed.ids.slice(0, MAX_COMPARE)
      : [];
    const names =
      parsed?.names && typeof parsed.names === 'object' ? parsed.names : {};
    return { ids, names };
  } catch {
    return { ids: [], names: {} };
  }
};

const writeStoredCompare = (ids, names) => {
  try {
    window.sessionStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify({ ids, names })
    );
  } catch {
    /* no-op: 영속화 실패해도 세션 내 동작은 유지 */
  }
};

const storedCompare = readStoredCompare();

export const useUIStore = create((set) => ({
  // 상태
  sidebarOpen: false,
  // 'light' | 'dark' | null(시스템 따름)
  theme: readStoredTheme(),
  compareMode: false,
  selectedToolsForCompare: storedCompare.ids,
  // 비교 선택 도구의 id->name 캐시. 선택 시점(ToolCard)에 이름을 함께 보관해
  // 비교 결과 일부 누락 시 "어떤 도구가 빠졌는지" 표시하는 데 사용(추가 API 호출 없음).
  compareNamesById: storedCompare.names,

  // 액션
  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    })),

  // 토글: 현재 효과적인 테마(시스템 포함)의 반대로 명시 전환.
  toggleDarkMode: () =>
    set((state) => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effectiveDark =
        state.theme === 'dark' || (state.theme === null && prefersDark);
      const next = effectiveDark ? 'light' : 'dark';
      writeStoredTheme(next);
      return { theme: next };
    }),

  toggleCompareMode: () =>
    set((state) => ({
      compareMode: !state.compareMode,
    })),

  // toolName 옵션: 전달되면 id->name 캐시에 보관(누락 도구 이름 안내용).
  addToolForCompare: (toolId, toolName) =>
    set((state) => {
      if (state.selectedToolsForCompare.length >= MAX_COMPARE) {
        return state; // 최대 5개까지만
      }
      if (state.selectedToolsForCompare.includes(toolId)) {
        return state; // 이미 추가됨
      }
      const nextIds = [...state.selectedToolsForCompare, toolId];
      const nextNames =
        toolName != null
          ? { ...state.compareNamesById, [toolId]: toolName }
          : state.compareNamesById;
      writeStoredCompare(nextIds, nextNames);
      return {
        selectedToolsForCompare: nextIds,
        compareNamesById: nextNames,
      };
    }),

  removeToolForCompare: (toolId) =>
    set((state) => {
      const restNames = { ...state.compareNamesById };
      delete restNames[toolId];
      const nextIds = state.selectedToolsForCompare.filter(
        (id) => id !== toolId
      );
      writeStoredCompare(nextIds, restNames);
      return {
        selectedToolsForCompare: nextIds,
        compareNamesById: restNames,
      };
    }),

  clearCompareList: () => {
    writeStoredCompare([], {});
    set({
      selectedToolsForCompare: [],
      compareNamesById: {},
      compareMode: false,
    });
  },

  closeSidebar: () =>
    set({
      sidebarOpen: false,
    }),
}));
