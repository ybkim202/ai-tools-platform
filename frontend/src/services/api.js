import axios from 'axios';

// API 기본 URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 인터셉터
// 백엔드는 DB 에러 등을 HTTP 200 + { success:false, error } 로 반환할 수 있다.
// axios는 이를 성공으로 처리하므로 catch가 트리거되지 않아 호출부가 빈 상태로 위장된다.
// 여기서 success:false 를 reject로 승격해 각 페이지의 ErrorState 경로로 흐르게 한다.
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === 'object' && body.success === false) {
      const apiError = new Error(
        body.error?.message || '요청 처리 중 오류가 발생했습니다.'
      );
      apiError.response = response;
      apiError.code = body.error?.code || 'API_ERROR';
      return Promise.reject(apiError);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ==================== Tools API ====================
export const toolsAPI = {
  // 도구 목록 조회
  getTools: (params = {}) => {
    return apiClient.get('/tools', { params });
  },

  // 도구 상세 조회
  getToolDetail: (toolId) => {
    return apiClient.get(`/tools/${toolId}`);
  },

  // 도구 검색
  searchTools: (searchQuery, params = {}) => {
    return apiClient.get('/tools', {
      params: { search: searchQuery, ...params },
    });
  },

  // 메타데이터(필터 옵션 소스) 조회
  // GET /api/tools/meta
  //   -> { success, data: { categories, tags, difficulties, tasks, professions,
  //                         total_tools, total_categories }, error }
  //   tasks/professions: 추천 탭의 타입별 옵션 소스(없으면 호출부에서 tags로 폴백).
  //   total_tools/total_categories: About 페이지 Hero 앵커 수치(실데이터 카운트).
  // 응답값으로 필터 옵션을 채운다(하드코딩 금지). 실패 시 호출부에서 최소 폴백.
  getMeta: () => {
    return apiClient.get('/tools/meta');
  },
};

// ==================== Recommendations API ====================
export const recommendationsAPI = {
  // 맞춤 추천
  getRecommendations: (task = null, profession = null, limit = 10) => {
    const params = { limit };
    if (task) params.task = task;
    if (profession) params.profession = profession;
    
    return apiClient.get('/recommendations', { params });
  },
};

// ==================== Compare API ====================
export const compareAPI = {
  // 도구 비교
  compareTools: (toolIds) => {
    return apiClient.get('/compare', {
      params: { ids: toolIds.join(',') },
    });
  },
};

// ==================== News API ====================
export const newsAPI = {
  // 뉴스 조회
  // params: { days, limit, offset, search, tool_id } — search는 제목/내용/도구명 ILIKE.
  // 응답: { success, data: [...], pagination: { total, limit, offset, pages }, error }.
  getNews: (params = {}) => {
    return apiClient.get('/news', { params });
  },

  // 트렌딩 뉴스
  getTrendingNews: (days = 7, limit = 10) => {
    return apiClient.get('/news/trending', {
      params: { days, limit },
    });
  },

  // 특정 도구의 뉴스
  getToolNews: (toolId, limit = 10) => {
    return apiClient.get('/news', {
      params: { tool_id: toolId, limit },
    });
  },
};

// ==================== Trending API ====================
export const trendingAPI = {
  // 깃헙 트렌딩 레포 조회 (/trends/github 페이지 데이터 소스).
  // params: { period('weekly'|'monthly'), theme(군집 키, 'all'이면 미전달), limit, offset }
  // 응답 계약(확정 — backend/app/routers/trends.py 구현 완료): {
  //   success,
  //   data: {
  //     repos: [{ id, owner, repo, name, avatar_url, html_url,
  //               description, description_ko, stars, language,
  //               topics: string[] }],
  //     themes: [{ key, label, count }],   // 'all' 포함, count 0 테마는 미포함 권장
  //     total,                              // 현재 범위/필터 총 개수
  //     collected_at                        // 신선도(수집일) ISO 문자열
  //   },
  //   pagination: { total, limit, offset, pages },
  //   error
  // }
  // 데이터는 수집 cron 점등 전 0행일 수 있음 → 빈 결과 시 EmptyNoDataState로 graceful.
  getGithubTrending: (params = {}) => {
    const { theme, ...rest } = params;
    // 'all' 또는 빈 테마는 서버에 전달하지 않는다(전체 = 필터 없음).
    const query =
      theme && theme !== 'all' ? { theme, ...rest } : { ...rest };
    return apiClient.get('/trends/github', { params: query });
  },
};

// ==================== Benchmarks API ====================
export const benchmarksAPI = {
  // 벤치마크 조회
  getBenchmarks: (params = {}) => {
    return apiClient.get('/benchmarks', { params });
  },

  // 벤치마크 요약
  getBenchmarkSummary: (toolId) => {
    return apiClient.get(`/benchmarks/summary/${toolId}`);
  },

  // 벤치마크 종류
  getBenchmarkTypes: () => {
    return apiClient.get('/benchmarks/types');
  },
};

// ==================== Events(전환 추적) API ====================
// 1st-party 클릭 전환 추적. 비가시 계측 — 사용자/화면에 어떤 상태도 노출하지 않는다.
// fire-and-forget: await 하지 않고 발사하며, 모든 실패(4xx/5xx/네트워크/타임아웃)는
// 침묵 catch 한다(콘솔 에러도 금지 — QA/사용자 노이즈 방지). 반환값 없음.
// name-agnostic 시그니처: 향후 about_page_view 등 다른 이벤트에도 재사용 가능.
// path: 호출부에서 window.location.pathname 전달. referrer는 백엔드 nullable(현재 생략).
export const trackEvent = (name, { target, path } = {}) => {
  try {
    apiClient.post('/events', { name, target, path }).catch(() => {});
  } catch (e) {
    // 동기 예외도 onClick 밖으로 전파 금지.
  }
};

// ==================== 에러 핸들러 ====================
export const handleApiError = (error) => {
  if (error.response) {
    // 서버가 응답했지만 에러 상태
    const errorData = error.response.data;
    const message = errorData?.error?.message || '요청 처리 중 오류가 발생했습니다.';
    const code = errorData?.error?.code || 'UNKNOWN_ERROR';
    
    return { message, code, status: error.response.status };
  } else if (error.request) {
    // 요청을 보냈지만 응답이 없음
    return {
      message: '서버에 연결할 수 없습니다.',
      code: 'NO_RESPONSE',
    };
  } else {
    // 요청을 설정하는 중에 오류 발생
    return {
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      code: 'REQUEST_ERROR',
    };
  }
};

export default apiClient;
