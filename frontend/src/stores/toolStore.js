import { create } from 'zustand';
import { toolsAPI, recommendationsAPI, handleApiError } from '../services/api';

// ==================== Tools Store ====================
export const useToolStore = create((set, get) => ({
  // 상태
  tools: [],
  selectedTool: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    limit: 20,
    offset: 0,
    pages: 0,
  },
  filters: {
    search: '',
    category: null,
    country: null,
    difficulty: null,
    sort_by: 'popularity',
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
    set({ loading: true, error: null });
    try {
      const response = await toolsAPI.getToolDetail(toolId);
      set({
        selectedTool: response.data.data,
        loading: false,
      });
    } catch (err) {
      const error = handleApiError(err);
      set({ error: error.message, loading: false });
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
export const useUIStore = create((set) => ({
  // 상태
  sidebarOpen: false,
  darkMode: localStorage.getItem('darkMode') === 'true',
  compareMode: false,
  selectedToolsForCompare: [],

  // 액션
  toggleSidebar: () =>
    set((state) => ({
      sidebarOpen: !state.sidebarOpen,
    })),

  toggleDarkMode: () =>
    set((state) => {
      const newDarkMode = !state.darkMode;
      localStorage.setItem('darkMode', newDarkMode);
      return { darkMode: newDarkMode };
    }),

  toggleCompareMode: () =>
    set((state) => ({
      compareMode: !state.compareMode,
    })),

  addToolForCompare: (toolId) =>
    set((state) => {
      if (state.selectedToolsForCompare.length >= 5) {
        return state; // 최대 5개까지만
      }
      if (state.selectedToolsForCompare.includes(toolId)) {
        return state; // 이미 추가됨
      }
      return {
        selectedToolsForCompare: [...state.selectedToolsForCompare, toolId],
      };
    }),

  removeToolForCompare: (toolId) =>
    set((state) => ({
      selectedToolsForCompare: state.selectedToolsForCompare.filter(
        (id) => id !== toolId
      ),
    })),

  clearCompareList: () =>
    set({
      selectedToolsForCompare: [],
      compareMode: false,
    }),

  closeSidebar: () =>
    set({
      sidebarOpen: false,
    }),
}));
