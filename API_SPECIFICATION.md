# 📡 API 명세

**Base URL**: `http://localhost:8000/api` (개발환경)  
**API Version**: v1  
**인증**: 선택적 API Key (`X-API-Key` 헤더). 유효 키는 환경변수(`API_KEYS`/`API_KEY`)에서만
로드되며, 키가 설정되지 않았으면 헤더 없이 모든 요청이 통과합니다. 헤더가 있으나 유효하지
않으면 401(`INVALID_API_KEY`)을 반환합니다.  
**레이트 리미팅**: API Key(없으면 클라이언트 IP) 기준 분당 100 요청. 초과 시
429(`RATE_LIMIT_EXCEEDED`). 인메모리 카운터로 다중 워커 환경에서는 워커별 독립 집계(전역
정밀 제한 아님).

---

## 📋 **목차**

1. [Tools (도구)](#tools-도구)
2. [Benchmarks (벤치마크)](#benchmarks-벤치마크)
3. [Pricing (가격)](#pricing-가격) — 미구현(도구 상세/비교 응답에 포함)
4. [News (뉴스)](#news-뉴스)
5. [Recommendations (추천)](#recommendations-추천)
6. [Compare (비교)](#compare-비교)
7. [에러 처리](#에러-처리)

---

## 🛠️ **Tools (도구)**

### **GET /tools**

도구 목록을 조회합니다. 필터링, 정렬, 페이징 지원.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `category` | string | ❌ | 카테고리 필터 | `생성형AI`, `이미지생성` |
| `country` | string | ❌ | 국가 필터 | `미국`, `한국` |
| `difficulty` | string | ❌ | 난이도 필터 | `쉬움`, `보통`, `어려움` |
| `min_price` | number | ❌ | 최소 가격 | `0` |
| `max_price` | number | ❌ | 최대 가격 | `100` |
| `min_users` | number | ❌ | 최소 사용자 수 | `1000000` |
| `max_users` | number | ❌ | 최대 사용자 수 | `10000000` |
| `sort_by` | string | ❌ | 정렬 기준 (기본값: popularity) | `popularity`, `name`, `difficulty`, `price`, `recent` |
| `limit` | number | ❌ | 페이지당 결과 수 (기본값: 20) | `10` |
| `offset` | number | ❌ | 오프셋 (페이징) | `0` |
| `search` | string | ❌ | 검색어 | `ChatGPT` |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ChatGPT",
      "logo_url": "https://...",
      "official_url": "https://openai.com",
      "description": "OpenAI의 대화형 AI 모델",
      "category": "생성형AI",
      "country": "미국",
      "difficulty": "쉬움",
      "user_count": 100000000,
      "user_count_source": "공식블로그",
      "user_count_date": "2024-05-20T00:00:00Z",
      "created_at": "2024-05-01T10:00:00Z",
      "updated_at": "2024-05-20T10:00:00Z"
    },
    // ... 더 많은 도구들
  ],
  "pagination": {
    "total": 127,
    "limit": 20,
    "offset": 0,
    "pages": 7
  }
}
```

**예시 요청**

```bash
curl "http://localhost:8000/api/tools?category=생성형AI&sort_by=popularity&limit=10"
```

---

### **GET /tools/meta**

필터 옵션 메타데이터를 조회합니다(프론트 필터 옵션 소스). 인증 불필요.

**요청 파라미터**: 없음

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "categories": ["생성형AI", "이미지생성"],
    "tags": ["개발자", "콘텐츠작성"],
    "difficulties": ["보통", "쉬움", "어려움"]
  },
  "error": null
}
```

- `categories`: `tools.category` distinct (null/빈값 제외, 정렬)
- `tags`: `tags.name` distinct (tags 테이블, null/빈값 제외, 정렬)
- `difficulties`: `tools.difficulty` distinct (null/빈값 제외, 정렬)

---

### **GET /tools/{id}**

특정 도구의 상세 정보를 조회합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `id` | number | ✅ | 도구 ID |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "ChatGPT",
    "logo_url": "https://...",
    "official_url": "https://openai.com",
    "description": "OpenAI의 대화형 AI 모델",
    "category": "생성형AI",
    "country": "미국",
    "difficulty": "쉬움",
    "user_count": 100000000,
    "user_count_source": "공식블로그",
    "user_count_date": "2024-05-20T00:00:00Z",
    "tasks": ["콘텐츠작성", "코딩"],
    "professions": ["개발자", "마케터"],
    "benchmarks": [
      {
        "id": 1,
        "benchmark_type": "MMLU",
        "score": 86.4,
        "source": "공식벤치마크",
        "collected_date": "2024-05-15T00:00:00Z"
      },
      {
        "id": 2,
        "benchmark_type": "HumanEval",
        "score": 92,
        "source": "커뮤니티",
        "collected_date": "2024-05-10T00:00:00Z"
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
        "plan_name": "프로",
        "price": 20,
        "currency": "USD",
        "billing_period": "monthly",
        "description": "고급 기능 포함"
      }
    ],
    "recent_news": [
      {
        "id": 1,
        "title": "GPT-4 Turbo 업데이트",
        "content": "새로운 성능 개선...",
        "news_date": "2024-05-20T00:00:00Z",
        "source_url": "https://..."
      }
    ]
  }
}
```

---

## 🎯 **Benchmarks (벤치마크)**

### **GET /benchmarks**

벤치마크 데이터를 조회합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구의 벤치마크만 |
| `benchmark_type` | string | ❌ | 벤치마크 종류 (MMLU, HumanEval, GSM8K, GPQA, MATH, MMMU). 전체 목록은 `GET /benchmarks/types` |
| `sort_by` | string | ❌ | 정렬 기준 (`score_desc`, `score_asc`, `recent`) |
| `limit` | number | ❌ | 최대 결과 수 (1~100, 기본 20) |
| `offset` | number | ❌ | 오프셋 (기본 0) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 1,
      "tool_name": "ChatGPT",
      "benchmark_type": "MMLU",
      "score": 86.4,
      "source": "공식벤치마크",
      "collected_date": "2024-05-15T00:00:00Z"
    }
  ]
}
```

> 페이징: `limit`(1~100, 기본 20), `offset`(기본 0)을 지원하며 응답에 `pagination`
> 객체(`total`, `limit`, `offset`, `pages`)가 포함됩니다.

---

### **GET /benchmarks/summary/{tool_id}**

특정 도구의 벤치마크 요약을 조회합니다(각 종류별 최신 점수 + 평균).

**경로 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ✅ | 요약을 조회할 도구 ID |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "tool_id": 1,
    "tool_name": "ChatGPT",
    "benchmarks": {
      "MMLU": { "score": 86.4, "source": "공식벤치마크", "collected_date": "2024-05-15T00:00:00Z" }
    },
    "average_score": 85.0
  }
}
```

- 도구가 없으면 `TOOL_NOT_FOUND`를 반환합니다(본문 `success:false`).

---

### **GET /benchmarks/types**

사용 가능한 모든 벤치마크 종류 목록과 각 종류별 데이터 개수를 반환합니다.

**요청 파라미터**: 없음

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    { "type": "GSM8K", "count": 12 },
    { "type": "MMLU", "count": 9 }
  ]
}
```

---

## 💰 **Pricing (가격)**

> **미구현**: 독립 `GET /pricing` 엔드포인트는 현재 라우터에 존재하지 않습니다. 가격
> 정보는 도구 상세(`GET /tools/{id}`)의 `pricing[]`과 비교(`GET /compare`)의 각 도구
> `pricing[]`를 통해서만 제공됩니다.

---

## 📰 **News (뉴스)**

### **GET /news**

최신 뉴스와 업데이트를 조회합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구의 뉴스만 |
| `days` | number | ❌ | 최근 N일 이내 (1~365, 기본값: 30) |
| `limit` | number | ❌ | 최대 결과 수 (1~100, 기본값: 20) |
| `offset` | number | ❌ | 오프셋 (기본값: 0) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 1,
      "tool_name": "ChatGPT",
      "title": "GPT-4 Turbo 업데이트",
      "content": "새로운 기능들이 추가되었습니다...",
      "news_date": "2024-05-20T00:00:00Z",
      "source_url": "https://openai.com/...",
      "collected_date": "2024-05-20T15:00:00Z"
    }
  ]
}
```

> 페이징: `limit`(1~100, 기본 20), `offset`(기본 0)을 지원하며 응답에 `pagination`
> 객체가 포함됩니다.

---

### **GET /news/trending**

최근 N일 내 업데이트(뉴스)가 많은 **도구 단위** 집계를 조회합니다(도구당 1행).

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `days` | number | ❌ | 최근 N일 이내 (1~30, 기본값: 7) |
| `limit` | number | ❌ | 최대 결과 수 (1~50, 기본값: 10) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "tool_id": 1,
      "tool_name": "ChatGPT",
      "update_count": 3,
      "latest_news_date": "2024-05-20T00:00:00Z"
    }
  ],
  "period_days": 7
}
```

---

## 🎁 **Recommendations (추천)**

### **GET /recommendations**

맞춤 추천을 받습니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `task` | string | ❌ | 업무 (콘텐츠작성, 이미지생성 등) | `콘텐츠작성` |
| `profession` | string | ❌ | 직업 (개발자, 디자이너 등) | `개발자` |
| `limit` | number | ❌ | 추천 개수 (1-50, 기본값: 10) | `10` |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ChatGPT",
      "category": "생성형AI",
      "user_count": 100000000,
      "difficulty": "쉬움",
      "reason": "'콘텐츠작성' 작업에 최적화된 도구입니다.",
      "matched_tags": ["콘텐츠작성", "코딩"]
    }
  ],
  "meta": {
    "feature_status": "ready",
    "query": {
      "task": "콘텐츠작성",
      "profession": null
    }
  },
  "error": null
}
```

- `data[]` 필드: `id`, `name`, `category`, `user_count`, `difficulty`, `reason`, `matched_tags` (점수 필드 없음).
- `matched_tags`: 매칭 근거 태그 이름 배열. task 추천은 도구의 `type='task'` 태그(요청 task 포함),
  profession 추천은 `type='profession'` 태그(요청 profession 포함). 인기 도구 폴백에는 포함되지 않는다.
- `meta.feature_status`:
  - `"ready"`: 정상 동작. task/profession 없는 인기 도구 경로는 항상 `"ready"`.
  - `"coming_soon"`: task/profession 추천에 필요한 태그 데이터(tags·tool_tags) 미적재.
    이때 `data`는 빈 배열.

**예시 요청**

```bash
curl "http://localhost:8000/api/recommendations?task=콘텐츠작성&limit=10"
```

---

## ⚖️ **Compare (비교)**

### **GET /compare**

여러 도구를 비교합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `ids` | string | ✅ | 비교할 도구 ID들 (쉼표로 구분, 2~5개) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "id": 1,
        "name": "ChatGPT",
        "category": "생성형AI",
        "user_count": 100000000,
        "difficulty": "쉬움",
        "official_url": "https://openai.com/chatgpt",
        "pricing": [
          {
            "plan": "무료",
            "price": 0,
            "currency": "USD",
            "billing_period": "free"
          }
        ],
        "benchmarks": {
          "MMLU": 86.4,
          "HumanEval": 92
        }
      }
    ],
    "total_tools": 1
  },
  "error": null
}
```

- 각 도구의 `pricing[]` 항목 필드: `plan`, `price`, `currency`, `billing_period`.
- `benchmarks`는 `{ benchmark_type: score }` 형태의 객체이며 데이터가 없으면 `{}`.
- 비교 대상 ID가 모두 존재하지 않으면 HTTP 404(`TOOL_NOT_FOUND`).
- ID 파싱 실패(숫자/쉼표 형식 아님) 또는 개수 위반(2개 미만 또는 5개 초과) 시
  HTTP 400(`INVALID_PARAMETERS`)을 반환합니다.

**예시 요청**

```bash
curl "http://localhost:8000/api/compare?ids=1,2,3"
```

---

## ❌ **에러 처리**

### **에러 응답 형식**

모든 에러 응답은 `data: null`을 포함합니다.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "요청한 도구를 찾을 수 없습니다."
  }
}
```

### **에러 코드** (exceptions.py / 라우터 기준)

| 상태코드 | 에러코드 | 설명 |
|---------|---------|------|
| 400 | `INVALID_PARAMETERS` | 잘못된 파라미터 (compare: ID 형식 오류 및 비교 도구 개수 위반 2~5개 포함) |
| 401 | `INVALID_API_KEY` | 유효하지 않은 API Key |
| 401 | `MISSING_API_KEY` | API Key 누락(필수 인증 경로) |
| 404 | `TOOL_NOT_FOUND` | 도구를 찾을 수 없음 (HTTP 404 status) |
| 422 | `VALIDATION_ERROR` | 요청 데이터 검증 실패 (FastAPI 422) |
| 429 | `RATE_LIMIT_EXCEEDED` | 요청 한도 초과 |
| 500 | `DATABASE_ERROR` | 데이터베이스 오류 |
| 500 | `INTERNAL_ERROR` | 서버 내부 오류 |

> `AUTHENTICATION_ERROR`(401)는 `exceptions.py`에 정의되어 있으나 현재 어떤 라우터/의존성에서도
> 발화하지 않습니다(예약). 인증 실패는 실제로는 `INVALID_API_KEY`/`MISSING_API_KEY`로 응답합니다.

---

## 📝 **데이터 타입**

### **Tool**
```typescript
{
  id: number
  name: string
  logo_url: string
  official_url: string
  description: string
  category: string
  country: string
  difficulty: "쉬움" | "보통" | "어려움"
  user_count: number
  user_count_source: string
  user_count_date: ISO8601
  created_at: ISO8601
  updated_at: ISO8601
}
```

### **Benchmark**
```typescript
{
  id: number
  tool_id: number
  benchmark_type: "MMLU" | "HumanEval" | "GSM8K" | "GPQA" | "MATH" | "MMMU"
  score: number (0-100)
  source: string
  collected_date: ISO8601
  created_at: ISO8601
}
```

### **Price**
```typescript
{
  id: number
  tool_id: number
  plan_name: string
  price: number
  currency: "USD" | "KRW" | ...
  billing_period: "monthly" | "annual" | "onetime" | "free"
  description: string
  created_at: ISO8601
}
```

---

## 🔍 **사용 예시**

### **Bash / cURL**

```bash
# 도구 검색
curl -X GET "http://localhost:8000/api/tools?search=ChatGPT&limit=5"

# 도구 상세 조회
curl -X GET "http://localhost:8000/api/tools/1"

# 맞춤 추천
curl -X GET "http://localhost:8000/api/recommendations?task=이미지생성&profession=디자이너"

# 비교
curl -X GET "http://localhost:8000/api/compare?ids=1,2,3"
```

### **Python**

```python
import requests

BASE_URL = "http://localhost:8000/api"

# 도구 검색
response = requests.get(f"{BASE_URL}/tools", params={"search": "ChatGPT"})
tools = response.json()["data"]

# 추천
response = requests.get(f"{BASE_URL}/recommendations", 
                       params={"task": "이미지생성"})
recommendations = response.json()["data"]
```

### **JavaScript**

```javascript
const BASE_URL = "http://localhost:8000/api";

// 도구 검색
const response = await fetch(`${BASE_URL}/tools?search=ChatGPT`);
const tools = await response.json();

// 비교
const compareResponse = await fetch(`${BASE_URL}/compare?ids=1,2,3`);
const comparison = await compareResponse.json();
```

---

**API 버전**: v1  
**마지막 업데이트**: 2026-05-31
