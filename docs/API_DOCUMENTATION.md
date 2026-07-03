# 📡 AITools API 완전 문서화

**Base URL**: `http://localhost:8000` (개발) / `https://api.aitools.com` (프로덕션)  
**API Version**: v1.0.0  
**Authentication**: Optional API Key (X-API-Key 헤더)

---

## 📋 **목차**

1. [시작하기](#시작하기)
2. [인증](#인증)
3. [에러 처리](#에러-처리)
4. [Tools API](#tools-api)
5. [Recommendations API](#recommendations-api)
6. [Compare API](#compare-api)
7. [News API](#news-api)
8. [Benchmarks API](#benchmarks-api)
9. [Trends API](#trends-api)
10. [Rate Limiting](#rate-limiting)

---

## 🚀 **시작하기**

### **Requirements**
- Python 3.9+
- FastAPI
- PostgreSQL 15+

### **설치**

```bash
# 1. 리포지토리 클론
git clone https://github.com/yourusername/ai-tools-platform.git
cd ai-tools-platform/backend

# 2. 가상환경 생성
python3 -m venv venv
source venv/bin/activate

# 3. 의존성 설치
pip install -r requirements.txt

# 4. 환경변수 설정
cp .env.example .env
# .env 파일에 DATABASE_URL 입력

# 5. 서버 실행
python3 -m uvicorn app.main:app --reload
```

### **확인**

```bash
# 헬스 체크
curl http://localhost:8000/health

# API 문서 (Swagger UI)
http://localhost:8000/docs
```

---

## 🔐 **인증**

### **선택적 인증 (Optional)**

API Key 없이도 대부분의 엔드포인트 사용 가능합니다.

```bash
# API Key 없음 (공개 API)
curl "http://localhost:8000/api/tools"

# API Key 포함 (인증됨)
curl -H "X-API-Key: your-api-key" "http://localhost:8000/api/tools"
```

### **API Key 설정**

유효 키는 환경변수에서만 로드됩니다. 소스에 하드코딩된 키는 없습니다.

- `API_KEYS`: 콤마로 구분된 키 목록 (권장)
- `API_KEY`: 단일 키 (하위 호환)

환경변수가 비어 있으면 유효 키가 존재하지 않으며, 이 경우 X-API-Key 헤더 없이 모든
요청이 통과합니다(선택적 인증). 헤더가 있으나 유효 키 집합에 없으면 401
(`INVALID_API_KEY`)을 반환합니다.

### **필수 인증이 필요한 엔드포인트**

현재 공개 엔드포인트는 모두 선택적 인증입니다. 향후 추가될 수 있습니다.

### **레이트리밋 적용 범위**

API Key 유무와 무관하게, 모든 공개 라우터(`tools`/`recommendations`/`compare`/`news`/`benchmarks`/`trends`)에
레이트리밋이 일괄 적용됩니다(`main.py` 의 `Depends(rate_limit_dependency)`). 식별 기준은 API Key가 있으면
키, 없으면 클라이언트 IP입니다. 한도·초과 응답·구현 한계는 [Rate Limiting](#rate-limiting) 절을 참조하세요.

---

## ❌ **에러 처리**

### **응답 형식**

모든 에러는 일관된 형식으로 반환됩니다(`data`는 항상 `null`):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "error_id": "1a2b3c4d"
  }
}
```

> `error_id`는 서버측 오류(`DATABASE_ERROR`·`INTERNAL_ERROR` 등 5xx)에만 포함되는 짧은
> 상관관계 ID입니다. **같은 id가 서버 로그 라인에도 남으므로**, 장애 신고 시 이 id로
> 로그의 traceback을 바로 찾을 수 있습니다(내부 메시지·스택은 응답에 노출하지 않음).
> 예상된 클라이언트 오류(404·400·422 등)에는 포함되지 않습니다.

### **에러 코드**

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `TOOL_NOT_FOUND` | 404 | 도구를 찾을 수 없음 |
| `INVALID_PARAMETERS` | 400 | 잘못된 파라미터 |
| `DATABASE_ERROR` | 500 | 데이터베이스 오류 |
| `INVALID_API_KEY` | 401 | 유효하지 않은 API Key |
| `MISSING_API_KEY` | 401 | API Key 누락 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청 한도 초과 |
| `VALIDATION_ERROR` | 422 | 요청 데이터 검증 실패 (FastAPI 422) |
| `AUTHENTICATION_ERROR` | 401 | 인증 실패 (예약 — 현재 코드 미발화) |

### **예시**

```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "요청한 도구를 찾을 수 없습니다."
  }
}
```

---

## 🔧 **Tools API**

도구 정보 조회, 필터링, 검색 기능

### **GET /api/tools**

도구 목록을 조회합니다.

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `search` | string | ❌ | 검색어 (이름·설명·카테고리·태그 부분일치, 대소문자 무시. 이름 매칭 우선 정렬) | `이미지` |
| `category` | string | ❌ | 카테고리 필터 | `생성형AI` |
| `country` | string | ❌ | 국가 필터 | `미국` |
| `difficulty` | string | ❌ | 난이도 필터 | `쉬움` |
| `min_price` | number | ❌ | 최소 가격 | `0` |
| `max_price` | number | ❌ | 최대 가격 | `100` |
| `min_users` | number | ❌ | 최소 사용자 수 | `1000000` |
| `max_users` | number | ❌ | 최대 사용자 수 | `100000000` |
| `open_source` | boolean | ❌ | 라이선스 필터: `true`=오픈소스, `false`=독점, 미지정=전체 (판정 기준: `github_repo` 보유 여부) | `true` |
| `sort_by` | string | ❌ | 정렬 (popularity/name/difficulty/price/recent). `popularity`는 `user_count DESC NULLS LAST` | `popularity` |
| `limit` | number | ❌ | 결과 수 (1-100, 기본: 20) | `10` |
| `offset` | number | ❌ | 오프셋 (페이징) | `0` |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "ChatGPT",
      "logo_url": "https://...",
      "official_url": "https://openai.com/chatgpt",
      "description": "OpenAI의 대화형 AI 모델...",
      "category": "생성형AI",
      "country": "미국",
      "difficulty": "쉬움",
      "user_count": 100000000,
      "user_count_source": "공식발표",
      "user_count_date": "2026-05-24T00:00:00",
      "created_at": "2026-05-24T00:00:00",
      "updated_at": "2026-05-24T00:00:00",
      "github_stars": null,
      "hn_points": null,
      "is_open_source": false
    }
  ],
  "pagination": {
    "total": 78,
    "limit": 20,
    "offset": 0,
    "pages": 4
  }
}
```

**인기지표 필드(자동 갱신)**

- `is_open_source` (boolean): 오픈소스 여부. `github_repo` 보유 시 `true`(오픈소스), 아니면 `false`(독점). 카드 라이선스 라벨·`open_source` 필터의 기준.
- `github_stars` (int|null): 오픈소스 도구의 GitHub stars. `github_repo`가 있는 도구만 일 1회 자동 갱신, 없으면 `null`. (프론트 카드는 `is_open_source=true`일 때만 ⭐ 노출)
- `hn_points` (int|null): 자동 발견(Hacker News "Show HN") 도구의 points. 수동 등록 도구는 `null`. (데이터는 보존하되 일반 사용자 카드에는 노출하지 않음)
- 두 값은 **검증 가능한 공식 API**(GitHub Repo API · HN Algolia)로만 채워진다. `user_count`(출처 불명확)는 **자동 갱신하지 않는다**(수동 유지). 도구 상세(`GET /api/tools/{id}`)는 여기에 더해 `source`(`manual`|`auto_hn`|`auto_github`)를 반환한다.

**예시**

```bash
# 생성형AI 도구 10개
curl "http://localhost:8000/api/tools?category=생성형AI&limit=10"

# ChatGPT 검색
curl "http://localhost:8000/api/tools?search=ChatGPT"

# 가격대별 필터
curl "http://localhost:8000/api/tools?min_price=0&max_price=50"
```

---

### **GET /api/tools/meta**

필터 옵션 메타데이터를 조회합니다. 프론트(Home/Recommendations)의 필터 옵션값을
DB 실제값과 동기화하기 위한 distinct 목록을 반환합니다. 인증 불필요.

**파라미터**: 없음

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "categories": ["생성형AI", "이미지생성"],
    "tags": ["개발자", "콘텐츠작성"],
    "difficulties": ["보통", "쉬움", "어려움"],
    "tasks": ["콘텐츠작성", "코딩개발"],
    "professions": ["개발자", "마케터"],
    "total_tools": 78,
    "total_categories": 12
  },
  "error": null
}
```

- `categories`: `tools.category` distinct (null/빈값 제외, 정렬)
- `tags`: `tags.name` distinct (tags 테이블, null/빈값 제외, 정렬) — 평면(하위호환)
- `difficulties`: `tools.difficulty` distinct (null/빈값 제외, 정렬)
- `tasks`: `tags.name` 중 `type = 'task'` distinct (null/빈값 제외, 정렬)
- `professions`: `tags.name` 중 `type = 'profession'` distinct (null/빈값 제외, 정렬)
- `total_tools`: `tools` 전체 행 수 (정수) — About 페이지 Hero 앵커 수치
- `total_categories`: distinct category 개수 (= `categories` 길이, 정수)

**예시**

```bash
curl "http://localhost:8000/api/tools/meta"
```

---

### **GET /api/tools/{tool_id}**

특정 도구의 상세 정보를 조회합니다.

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ✅ | 도구 ID |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "ChatGPT",
    "description": "...",
    "category": "생성형AI",
    "country": "미국",
    "user_count": 100000000,
    "github_stars": null,
    "hn_points": null,
    "source": "manual",
    "is_open_source": false,
    "github_repo": null,
    "long_description": "위키백과 등 출처의 상세 소개(없으면 null)",
    "description_source": "wikipedia",
    "description_source_url": "https://...",
    "representative_model": null,
    "metrics_synced_at": null,
    "created_at": "2026-05-31T01:24:04",
    "updated_at": "2026-06-04T04:46:31",
    "tasks": ["콘텐츠작성", "코딩"],
    "professions": ["개발자", "마케터"],
    "benchmarks": [
      {
        "id": 1,
        "benchmark_type": "MMLU",
        "score": 86.4,
        "source": "공식벤치마크",
        "collected_date": "2026-05-15T00:00:00"
      }
    ],
    "pricing": [
      {
        "id": 1,
        "plan_name": "무료",
        "price": 0,
        "currency": "USD",
        "billing_period": "free",
        "description": "기본 기능만 사용 가능"
      },
      {
        "id": 2,
        "plan_name": "Pro",
        "price": 20,
        "currency": "USD",
        "billing_period": "monthly",
        "description": "고급 기능 포함"
      }
    ],
    "models": [
      {
        "model_name": "Claude Opus 4.8",
        "model_slug": "anthropic/claude-opus-4.8",
        "tier": "flagship",
        "context_length": 1000000,
        "input_modalities": "text,image,file",
        "output_modalities": "text",
        "price_input": 0.000005,
        "price_output": 0.000025,
        "is_flagship": true,
        "source": "openrouter",
        "source_url": "https://openrouter.ai/models"
      }
    ],
    "recent_news": [
      {
        "id": 1,
        "title": "GPT-4 Turbo 업데이트",
        "content": "새로운 성능 개선...",
        "news_date": "2026-05-20T00:00:00",
        "source_url": "https://..."
      }
    ]
  }
}
```

- `tasks`: 해당 도구의 `tags.type='task'` 태그 이름 배열 (없으면 `[]`).
- `professions`: 해당 도구의 `tags.type='profession'` 태그 이름 배열 (없으면 `[]`).
- `models`: 세부 모델 라인업(`tool_models`). OpenRouter Models API로 `provider_slug`/이름 매칭 도구만 채워진다(LLM 계열). 비대상 도구는 `[]`. `price_input/price_output`은 **토큰당 USD**(프론트는 1M 토큰당으로 환산 표시). `tier`는 `flagship|balanced|fast`.
- `long_description`/`description_source`/`description_source_url`: 상세 소개와 출처(위키백과 요약 수집). 없으면 `null`.
- `github_repo`(owner/repo)·`created_at`·`updated_at`·`metrics_synced_at`: 스펙/이력 표시용.

**예시**

```bash
# ChatGPT 상세 정보
curl "http://localhost:8000/api/tools/4"
```

---

## 💡 **Recommendations API**

맞춤 추천

### **GET /api/recommendations**

업무 또는 직업에 따른 도구 추천

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `task` | string | ❌ | 업무 | `콘텐츠작성` |
| `profession` | string | ❌ | 직업 | `개발자` |
| `limit` | number | ❌ | 추천 개수 (기본: 10) | `5` |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "name": "ChatGPT",
      "category": "생성형AI",
      "user_count": 100000000,
      "difficulty": "쉬움",
      "logo_url": "https://...",
      "official_url": "https://openai.com/chatgpt",
      "reason": "'콘텐츠작성' 작업에 최적화된 도구입니다.",
      "matched_tags": ["콘텐츠작성", "코딩"]
    }
  ],
  "meta": {
    "feature_status": "ready",
    "query": {
      "task": null,
      "profession": null
    }
  },
  "error": null
}
```

- `logo_url`·`official_url`: 카드 로고 표시용(프론트 `resolveLogoSrc` — logo_url 없으면 official_url 도메인 파비콘, 그것도 없으면 레터 아바타). 추천 카루셀이 ToolCard를 그대로 쓰므로 다른 목록과 동일 필드 제공.
- `matched_tags`: 매칭 근거 태그 이름 배열.
  - `task` 추천: 각 도구가 가진 `type='task'` 태그 이름들(요청한 task 포함).
  - `profession` 추천: 각 도구가 가진 `type='profession'` 태그 이름들(요청한 profession 포함).
  - 인기 도구 폴백(파라미터 없음)은 매칭 근거가 없어 `matched_tags`를 포함하지 않는다.
- `meta.feature_status`:
  - `"ready"`: 정상 동작. task/profession 없이 인기 도구를 반환하는 경로는 항상 `"ready"`.
  - `"coming_soon"`: task/profession 추천에 필요한 태그 데이터(tags·tool_tags)가 DB에
    미적재. 이 경우 `data`는 빈 배열이며 프론트는 "준비 중" 안내를 표시한다.

**예시**

```bash
# 업무별 추천
curl "http://localhost:8000/api/recommendations?task=콘텐츠작성"

# 직업별 추천
curl "http://localhost:8000/api/recommendations?profession=개발자"

# 인기 도구
curl "http://localhost:8000/api/recommendations"
```

---

## ⚖️ **Compare API**

도구 비교

### **GET /api/compare**

여러 도구를 비교합니다.

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `ids` | string | ✅ | 도구 ID들 (쉼표로 구분, 2~5개) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "id": 4,
        "name": "ChatGPT",
        "category": "생성형AI",
        "user_count": 100000000,
        "difficulty": "쉬움",
        "official_url": "https://openai.com/chatgpt",
        "logo_url": "https://...",
        "is_open_source": false,
        "pricing": [
          {
            "plan": "무료",
            "price": 0,
            "currency": "USD",
            "billing_period": "free"
          }
        ],
        "benchmarks": {
          "MMLU": {
            "score": 86.4,
            "source": "Artificial Analysis",
            "unit": "percent",
            "max_score": 100,
            "collected_date": "2026-06-01T00:00:00"
          },
          "GPQA Diamond": {
            "score": 53.6,
            "source": "Artificial Analysis",
            "unit": "percent",
            "max_score": 100,
            "collected_date": "2026-06-01T00:00:00"
          }
        }
      }
    ],
    "total_tools": 3
  },
  "error": null
}
```

> `benchmarks`는 `benchmark_type → { score, source, unit, max_score, collected_date }` 형태의 중첩 객체입니다.
> 같은 `benchmark_type`이 여러 행이면 `collected_date` 기준 **최신 1행**만 반환합니다.
> - `score`: 숫자 점수(없으면 `null`)
> - `source`: 출처(예: `"Artificial Analysis"`) — 프론트에서 점수 아래 보조 텍스트로 표기
> - `unit`: `"percent"`면 만점 맥락(`/100`)으로 표시, 그 외 단위는 접미사로 표기(예: `"elo"`)
> - `max_score`: `unit` 파생 만점 — `percent`→`100`, 그 외(`elo` 등)→`null`(상한 없음). 프론트가 `/100` 매직넘버를 하드코딩하지 않도록 명시.
> - `collected_date`: 측정 신선도(없으면 `null`). 점수 옆 `YYYY-MM`로 표기.
> 벤치마크가 없는 도구는 `"benchmarks": {}` (빈 객체)를 반환합니다.

> 비교 대상 ID가 모두 존재하지 않으면 HTTP 404 (`TOOL_NOT_FOUND`)를 반환합니다.
> 비교 도구 개수가 2개 미만이거나 5개 초과면, 또는 ID가 숫자가 아니면 HTTP 400 (`INVALID_PARAMETERS`)를 반환합니다.

**예시**

```bash
# 3개 도구 비교
curl "http://localhost:8000/api/compare?ids=4,5,6"
```

---

## 📰 **News API**

뉴스 및 업데이트

### **GET /api/news**

최신 뉴스 조회

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구의 뉴스만 |
| `days` | number | ❌ | 최근 N일 (1-365, 기본: 30) |
| `search` | string | ❌ | 제목/내용/도구명 검색어 (부분 일치, 대소문자 무시) |
| `limit` | number | ❌ | 결과 수 (기본: 20) |
| `offset` | number | ❌ | 오프셋 |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 4,
      "tool_name": "ChatGPT",
      "title": "GPT-4 Turbo Update",
      "content": "New capabilities have been added...",
      "news_date": "2026-05-20T00:00:00",
      "source_url": "https://openai.com/...",
      "collected_date": "2026-05-20T00:00:00",
      "title_ko": "GPT-4 Turbo 업데이트",
      "summary_ko": "새로운 기능들이 추가되었습니다."
    }
  ],
  "pagination": {
    "total": 0,
    "limit": 20,
    "offset": 0,
    "pages": 0
  }
}
```

> **`title_ko` / `summary_ko`** (추가 필드, 비파괴): 영어 뉴스를 무료 MyMemory 번역 API(키 불필요)로
> 번역한 한국어 제목/번역 스니펫. 선택적으로 `MYMEMORY_EMAIL` 환경변수를 주면 무료 일일 한도가 확대된다.
> 네트워크/쿼터 실패 시 `null`. 프론트는 값이 있으면 한글,
> 없으면 원문(`title`/`content`)을 표시한다. `/api/news/trending` 은 도구 단위 집계(개수/최신일자)만
> 반환하므로 이 필드를 포함하지 않는다.

### **GET /api/news/trending**

최근 N일간 업데이트(뉴스)가 가장 많은 **도구 단위** 집계 (도구당 1행)

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `days` | number | ❌ | 최근 N일 (1-30, 기본: 7) |
| `limit` | number | ❌ | 결과 수 (기본: 10) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "tool_id": 4,
      "tool_name": "ChatGPT",
      "update_count": 5,
      "latest_news_date": "2026-05-20T00:00:00"
    }
  ],
  "period_days": 7
}
```

**예시**

```bash
# 모든 뉴스
curl "http://localhost:8000/api/news?limit=10"

# 특정 도구 뉴스
curl "http://localhost:8000/api/news?tool_id=4"
curl "http://localhost:8000/api/news?search=gpt"

# 트렌딩
curl "http://localhost:8000/api/news/trending"
```

---

## 📊 **Benchmarks API**

성능 벤치마크

### **GET /api/benchmarks**

벤치마크 데이터 조회

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구만 |
| `benchmark_type` | string | ❌ | 벤치마크 종류 (GPQA Diamond, MMLU-Pro, SWE-bench Verified, AIME 2025, MMMU, LMArena Elo 등). 전체 목록은 `GET /api/benchmarks/types` |
| `sort_by` | string | ❌ | 정렬 (score_desc/score_asc/recent) |
| `limit` | number | ❌ | 결과 수 (기본: 20) |
| `offset` | number | ❌ | 오프셋 |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 4,
      "tool_name": "ChatGPT",
      "benchmark_type": "GPQA Diamond",
      "score": 93.5,
      "source": "Artificial Analysis — GPQA Diamond (snapshot 2026-06)",
      "collected_date": "2026-06-04T00:00:00",
      "category": "추론",
      "model_version": "GPT-5.5",
      "unit": "percent",
      "max_score": 100,
      "logo_url": "https://.../favicon.ico",
      "official_url": "https://openai.com/chatgpt"
    }
  ],
  "pagination": {
    "total": 0,
    "limit": 20,
    "offset": 0,
    "pages": 0
  }
}
```

**필드 (additive)**: `category`(추론/코딩/수학/멀티모달/선호/종합), `model_version`(어느 모델 점수인지), `unit`(`percent`|`elo`), `max_score`(`unit` 파생 만점 — `percent`→`100`, `elo`→`null`), `logo_url`(도구 로고 — `tools` JOIN 파생, 랜딩 프리뷰 등 시각용), `official_url`(도구 공식 URL — `tools` JOIN 파생. 프론트 로고 폴백 체인이 `logo_url` 부패 시 이 도메인의 파비콘으로 자가치유하는 데 사용). `score`는 항상 raw(정규화 전). `unit='elo'`(LMArena)는 0~100 percent와 스케일이 다르다(만점 없음 → `max_score: null`).

### **GET /api/benchmarks/summary/{tool_id}**

도구별 벤치마크 요약 (종류별 최신 1행)

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "tool_id": 4,
    "tool_name": "ChatGPT",
    "benchmarks": {
      "GPQA Diamond": {
        "score": 93.5,
        "source": "Artificial Analysis — GPQA Diamond (snapshot 2026-06)",
        "collected_date": "2026-06-04T00:00:00",
        "category": "추론",
        "model_version": "GPT-5.5",
        "unit": "percent",
        "max_score": 100
      }
    },
    "average_score": 93.5
  }
}
```

### **GET /api/benchmarks/types**

사용 가능한 벤치마크 종류 목록 (category·unit 포함 — 프론트가 type→category 매핑을 DB 기준으로)

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    { "type": "GPQA Diamond", "category": "추론", "unit": "percent", "max_score": 100, "count": 4 },
    { "type": "LMArena Elo", "category": "선호", "unit": "elo", "max_score": null, "count": 3 }
  ]
}
```

### **GET /api/benchmarks/categories**

카테고리별 메타 (벤치마크 페이지 섹션 구동)

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    { "category": "추론", "unit": "percent", "type_count": 2, "row_count": 6 },
    { "category": "선호", "unit": "elo", "type_count": 1, "row_count": 3 }
  ]
}
```

### **GET /api/benchmarks/matrix**

다축 비교 매트릭스 — 카테고리(또는 지정 도구들)의 type×tool 최신 점수를 1콜로

**파라미터**: `category`(예: `추론`) 또는 `tool_ids`(쉼표구분, 예: `1,2,3`). 둘 다 미지정이면 전체.

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "category": "추론",
    "types": [ {"type": "GPQA Diamond", "unit": "percent", "max_score": 100}, {"type": "MMLU-Pro", "unit": "percent", "max_score": 100} ],
    "tools": [
      {
        "tool_id": 4, "tool_name": "ChatGPT",
        "scores": { "GPQA Diamond": {"score": 93.5, "unit": "percent", "max_score": 100, "model_version": "GPT-5.5", "source": "...", "collected_date": "2026-06-04T00:00:00"} }
      }
    ]
  }
}
```
`score`는 항상 raw(정규화 전). 카테고리 섹션·레이더/막대그룹 표시용 정규화는 프론트가 카테고리(축) 내 min-max로 수행한다.

**예시**

```bash
# 벤치마크 종류
curl "http://localhost:8000/api/benchmarks/types"

# 특정 도구 요약
curl "http://localhost:8000/api/benchmarks/summary/4"

# 카테고리 섹션 메타 / 다축 매트릭스
curl "http://localhost:8000/api/benchmarks/categories"
curl "http://localhost:8000/api/benchmarks/matrix?category=추론"
curl "http://localhost:8000/api/benchmarks/matrix?tool_ids=1,2,3"
```

---

## 📈 **Trends API**

깃헙 트렌딩 오픈소스(최근 생성 + 고별점)

### **GET /api/trends/github**

급부상 오픈소스를 기간·주제별로 조회한다. 트렌딩 정의(v1) = 최근 생성(주간=7일/월간=30일 내 `created`) + 별점 내림차순. 오래된 인기 레포는 포함되지 않는다(velocity 는 v2).

데이터 소스는 `github_trending` 테이블(수집기 `collectors/github_trending.py` 가 period 별로 멱등 교체). 주제(테마) 군집 매핑은 서버 파이썬(`app/trends_themes.py` 단일 정본)에서 수행되어 응답의 `themes[]` 에 임베드된다(별도 `/topics` 엔드포인트 없음).

**파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `period` | string | ❌ | 기간 `weekly`\|`monthly` (기본: `weekly`, 비정상값은 `weekly` 로 정규화) |
| `theme` | string | ❌ | 주제 군집 key. 허용: `agent`, `rag`, `local-llm`, `image`, `voice`, `finetune`, `mlops`. 미지정/`all`/비유효 키는 전체(필터 없음) |
| `limit` | number | ❌ | 페이지당 레포 수 (1-100, 기본: 12) |
| `offset` | number | ❌ | 오프셋 (≥0) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "repos": [
      {
        "id": 1,
        "owner": "langchain-ai",
        "repo": "langchain",
        "name": "langchain",
        "avatar_url": "https://avatars.githubusercontent.com/...",
        "html_url": "https://github.com/langchain-ai/langchain",
        "description": "Build context-aware reasoning applications",
        "description_ko": "맥락 인식 추론 애플리케이션 구축",
        "stars": 1234,
        "language": "Python",
        "topics": ["rag", "agents", "llm"]
      }
    ],
    "themes": [
      { "key": "all", "label": "전체", "count": 60 },
      { "key": "rag", "label": "RAG", "count": 8 },
      { "key": "agent", "label": "AI 에이전트", "count": 5 }
    ],
    "total": 60,
    "collected_at": "2026-05-31T00:00:00+00:00"
  },
  "pagination": {
    "total": 60,
    "limit": 12,
    "offset": 0,
    "pages": 5
  },
  "error": null
}
```

> **`themes[]`**: 주제 군집 카운트. `all`(label `전체`) 은 해당 period 전체 개수로 항상 포함되며, count 0 인 큐레이션 테마는 응답에서 제외된다. 카운트는 **theme 필터 적용 전(period 전체) 기준**으로 집계되고, `total` 은 **theme 필터 적용 후** 개수다.
> **`description_ko`** (비파괴): 영어 설명을 무료 MyMemory 번역 API(키 불필요)로 옮긴 한국어. 네트워크/쿼터 실패 시 `null`(원문 `description` 유지). 프론트는 값이 있으면 한글, 없으면 원문을 표시한다.
> **`collected_at`**: 해당 period 의 `MAX(collected_date)` (신선도 표기용). 데이터가 없으면 `null`.

**예시**

```bash
# 주간 전체 트렌딩
curl "http://localhost:8000/api/trends/github?period=weekly&limit=12"

# 월간 + RAG 테마 필터
curl "http://localhost:8000/api/trends/github?period=monthly&theme=rag"
```

---

## 📡 **Events API**

1st-party 클릭 전환 추적. About 페이지 CTA 클릭을 비가시(invisible)로 계측한다. 프론트(`services/api.js`의 `trackEvent`)는 **fire-and-forget**(await 안 함, 모든 실패 침묵 catch)으로 호출하므로, 응답 본문/지연/에러는 사용자 동선에 영향을 주지 않는다.

> **상태**: 구현 완료(`backend/app/routers/events.py`, `events` 테이블). 본 문서가 계약 정본이다.

### 개인정보 방침 (확정)

**IP 주소·User-Agent 등 식별 정보는 수집·저장하지 않는다.** 라우터는 `request.client.host` 나 User-Agent 헤더를 읽지 않으며, 저장 컬럼은 `name`/`target`/`path`/`referrer`/`created_at` 뿐이다. `referrer` 는 nullable 이고 **현재 프론트는 전송하지 않는다**(항상 NULL — 향후 확장 여지만 둔다).

### **POST /api/events**

전환 이벤트 1건을 적재한다. 인증 불필요(공개 쓰기). **레이트 리미팅 적용**(다른 공개 엔드포인트와 동일하게 `rate_limit_dependency` — 분당 100, IP 기준. 아래 Rate Limiting 절 참고).

**요청 바디**

```json
{
  "name": "about_cta_click",
  "target": "closing_explore",
  "path": "/about"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `name` | string | ✅ | 이벤트명. **화이트리스트**: 현재 `about_cta_click` 만 허용(패턴 `^[a-z0-9_]{1,40}$` + 화이트리스트). 그 외 값은 400 |
| `target` | string | ✅ | 전환 지점 ID. 패턴 `^[a-z0-9_]{1,40}$`(길이 1~40). 위반 시 400. (예: `story_recommend`, `closing_explore`) |
| `path` | string | ✅ | 이벤트 발생 SPA 경로 (예: `/about`). 길이 1~256. 프론트는 `window.location.pathname` 전송 |
| `referrer` | string | ❌ | 직전 경로(SPA). **현재 프론트는 미전송 → 항상 NULL 저장**. nullable |

> **검증 실패 응답**: 화이트리스트/정규식/길이 위반은 `400 INVALID_PARAMETERS`, 바디 필드 누락은 `422 VALIDATION_ERROR`. 어느 경우든 `{success,data,error}` 포맷이며, 보안상 클라이언트가 보낸 `path`/`target` 값을 에러 메시지에 **에코백하지 않는다**. 프론트는 모든 실패를 침묵 처리한다.

**About 전환 지점 target 사전(8개)**

| target | 위치 | 목적지 |
|--------|------|--------|
| `story_recommend` | Story 01 인라인 | `/recommendations` |
| `story_compare` | Story 02 인라인 | `/compare` |
| `story_benchmark` | Story 02 인라인 | `/benchmarks` |
| `story_github` | Story 03 인라인 | `/trends/github` |
| `story_news` | Story 03 인라인 | `/news` |
| `story_explore` | Story 04 인라인 | `/` |
| `closing_explore` | Closing 1차 솔리드 | `/` |
| `closing_recommend` | Closing 보조 | `/recommendations` |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": { "recorded": true },
  "error": null
}
```

### 구현 메모 (확정)

- 라우터: `backend/app/routers/events.py` (Railway 상대 import 규칙 준수 — `from ..database`, `from ..exceptions`). `main.py` 에 `Depends(rate_limit_dependency)` 로 등록.
- 적재 테이블: `events(id, name VARCHAR(40), target VARCHAR(40), path VARCHAR(256), referrer VARCHAR(512) NULL, created_at TIMESTAMP DEFAULT now())`. `idx_events_created_at` 인덱스. 정본은 `backend/schema.sql`(`init_db.py` 로 멱등 적용).
- DB 접근은 parameterized `text()` `:name` 바인딩(SQLi 금지). 응답은 `{success,data,error}` 포맷.
- 개인정보: IP/User-Agent 미수집(위 "개인정보 방침" 참조).

---

## ⚡ **Rate Limiting**

### **한도**

- **분당 요청 수**: 100개
- **제한 대상**: API Key 기준, 키가 없으면 클라이언트 IP 기준
- **초과 시 응답**: HTTP 429 (`RATE_LIMIT_EXCEEDED`)
- **구현 한계**: 인메모리 카운터이므로 다중 워커/인스턴스 환경에서는 워커별로 독립
  집계됩니다(정확한 전역 제한 아님). 정밀 제한이 필요하면 Redis 등 외부 저장소로
  이전해야 합니다.

### **예시**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "분당 100개 요청으로 제한됩니다."
  }
}
```

---

## 🔗 **SDK & 클라이언트**

### **Python**

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 도구 검색
response = requests.get(f"{BASE_URL}/tools", params={"search": "ChatGPT"})
tools = response.json()["data"]

# 비교
response = requests.get(f"{BASE_URL}/compare", params={"ids": "4,5,6"})
comparison = response.json()["data"]["comparison"]
```

### **JavaScript**

```javascript
const BASE_URL = "http://localhost:8000/api";

// 도구 검색
const response = await fetch(`${BASE_URL}/tools?search=ChatGPT`);
const tools = await response.json();

// 비교
const compareResponse = await fetch(`${BASE_URL}/compare?ids=4,5,6`);
const comparison = await compareResponse.json();
```

---

## 📞 **지원**

- **문서**: http://localhost:8000/docs (Swagger UI)
- **GitHub Issues**: [여기](https://github.com/yourusername/ai-tools-platform/issues)
- **이메일**: support@aitools.com

---

**Last Updated**: 2026-05-31  
**Version**: 1.0.0
