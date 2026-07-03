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
      // 서버측 오류(5xx)에 실린 상관관계 ID. 응답↔서버 로그를 잇는 식별자라
      // ErrorState에 노출해 사용자가 장애 신고 시 전달할 수 있게 한다.
      apiError.errorId = body.error?.error_id;
      return Promise.reject(apiError);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// ==================== Tools API ====================
export const toolsAPI = {
  // 도구 목록 조회. 각 도구는 기존 필드 + 인기지표/라이선스를 포함한다:
  //   github_stars:   오픈소스 도구의 GitHub stars(자동 갱신). 없으면 null.
  //   is_open_source: 오픈소스 여부(boolean). 카드 라이선스 배지·필터의 소스.
  // 인기지표는 "검증 가능한 공식 소스"로만 채워지며 user_count는 자동 갱신하지 않는다.
  // params(선택): { search, category, difficulty, sort_by, limit, offset,
  //   open_source } — open_source는 true(오픈소스)/false(독점)/undefined(전체).
  getTools: (params = {}) => {
    return apiClient.get('/tools', { params });
  },

  // 도구 상세 조회. 목록 필드 + 상세 전용 필드를 포함한다:
  //   github_stars, hn_points, is_open_source, source, github_repo(owner/repo),
  //   long_description, description_source('wikipedia'|'curated'|'official'),
  //   description_source_url, representative_model, metrics_synced_at,
  //   created_at, updated_at,
  //   tasks[], professions[], benchmarks[], pricing[], recent_news[],
  //   models[]: { model_name, model_slug, tier('flagship'|'balanced'|'fast'),
  //     context_length, input_modalities, output_modalities, price_input,
  //     price_output(토큰당 USD), is_flagship, source, source_url } (라인업 없으면 []).
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
  // 응답: { success, data: { comparison: [...], total_tools: N }, error }.
  // 각 도구의 benchmarks는 중첩 객체(같은 type은 collected_date 최신 1행):
  //   { "MMLU": { score: 86.4, source: "Artificial Analysis", unit: "percent",
  //               max_score: 100, collected_date: "2026-06-01..." }, ... }
  //   max_score: unit 파생 만점(percent→100, elo→null). collected_date: 측정 신선도.
  //   (구버전은 값=숫자였음. utils/benchmark.js의 benchmarkScore가 양쪽을 흡수.)
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
  // 벤치마크 조회. 응답 행에 logo_url(tools JOIN 파생) 포함 — 랜딩 프리뷰 등 시각용.
  getBenchmarks: (params = {}) => {
    return apiClient.get('/benchmarks', { params });
  },

  // 벤치마크 요약
  getBenchmarkSummary: (toolId) => {
    return apiClient.get(`/benchmarks/summary/${toolId}`);
  },

  // 벤치마크 종류. 응답에 category·unit·max_score 포함(프론트가 type→category 매핑을
  // DB 기준으로, 만점 맥락을 unit 파생값으로 — 매직넘버 100 하드코딩 제거).
  getBenchmarkTypes: () => {
    return apiClient.get('/benchmarks/types');
  },

  // 카테고리 메타(섹션 구동). -> { success, data: [{category, unit, type_count, row_count}] }
  getBenchmarkCategories: () => {
    return apiClient.get('/benchmarks/categories');
  },

  // 다축 비교 매트릭스(카테고리 또는 지정 도구들의 type×tool 최신 점수, 1콜).
  // params: { category?: string, tool_ids?: '1,2,3' }
  //   -> { success, data: { category, types:[{type,unit,max_score}],
  //        tools:[{tool_id,tool_name,scores:{type:{score,unit,max_score,model_version,
  //        source,collected_date}}}] } }
  //   score는 항상 raw(정규화 전). 표시용 정규화는 프론트 책임.
  //   max_score: unit 파생 만점(percent→100, elo→null). collected_date: 측정 신선도.
  getBenchmarkMatrix: (params = {}) => {
    return apiClient.get('/benchmarks/matrix', { params });
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
    // error_id: 서버 5xx에만 실린다(예상된 4xx에는 없음). 없으면 undefined.
    const errorId = errorData?.error?.error_id;

    return { message, code, status: error.response.status, errorId };
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
