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
9. [Rate Limiting](#rate-limiting)

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
    "message": "에러 메시지"
  }
}
```

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
| `search` | string | ❌ | 검색어 (도구명) | `ChatGPT` |
| `category` | string | ❌ | 카테고리 필터 | `생성형AI` |
| `country` | string | ❌ | 국가 필터 | `미국` |
| `difficulty` | string | ❌ | 난이도 필터 | `쉬움` |
| `min_price` | number | ❌ | 최소 가격 | `0` |
| `max_price` | number | ❌ | 최대 가격 | `100` |
| `min_users` | number | ❌ | 최소 사용자 수 | `1000000` |
| `max_users` | number | ❌ | 최대 사용자 수 | `100000000` |
| `sort_by` | string | ❌ | 정렬 (popularity/name/difficulty/price/recent) | `popularity` |
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
      "updated_at": "2026-05-24T00:00:00"
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
    "professions": ["개발자", "마케터"]
  },
  "error": null
}
```

- `categories`: `tools.category` distinct (null/빈값 제외, 정렬)
- `tags`: `tags.name` distinct (tags 테이블, null/빈값 제외, 정렬) — 평면(하위호환)
- `difficulties`: `tools.difficulty` distinct (null/빈값 제외, 정렬)
- `tasks`: `tags.name` 중 `type = 'task'` distinct (null/빈값 제외, 정렬)
- `professions`: `tags.name` 중 `type = 'profession'` distinct (null/빈값 제외, 정렬)

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
        "pricing": [
          {
            "plan": "무료",
            "price": 0,
            "currency": "USD",
            "billing_period": "free"
          }
        ],
        "benchmarks": {}
      }
    ],
    "total_tools": 3
  },
  "error": null
}
```

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
      "title": "GPT-4 Turbo 업데이트",
      "content": "새로운 기능들이 추가되었습니다...",
      "news_date": "2026-05-20T00:00:00",
      "source_url": "https://openai.com/...",
      "collected_date": "2026-05-20T00:00:00"
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
| `benchmark_type` | string | ❌ | 벤치마크 종류 (MMLU, HumanEval, GSM8K, GPQA, MATH, MMMU). 전체 목록은 `GET /api/benchmarks/types` |
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
      "benchmark_type": "MMLU",
      "score": 86.4,
      "source": "공식벤치마크",
      "collected_date": "2026-05-15T00:00:00"
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

### **GET /api/benchmarks/summary/{tool_id}**

도구별 벤치마크 요약

**응답 (200 OK)**

```json
{
  "success": true,
  "data": {
    "tool_id": 4,
    "tool_name": "ChatGPT",
    "benchmarks": {
      "MMLU": {
        "score": 86.4,
        "source": "공식벤치마크",
        "collected_date": "2026-05-15T00:00:00"
      }
    },
    "average_score": 86.4
  }
}
```

### **GET /api/benchmarks/types**

사용 가능한 벤치마크 종류 목록

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "type": "GSM8K",
      "count": 5
    },
    {
      "type": "MMLU",
      "count": 3
    }
  ]
}
```

**예시**

```bash
# 벤치마크 종류
curl "http://localhost:8000/api/benchmarks/types"

# 특정 도구 요약
curl "http://localhost:8000/api/benchmarks/summary/4"

# MMLU 벤치마크 정렬
curl "http://localhost:8000/api/benchmarks?benchmark_type=MMLU&sort_by=score_desc"
```

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
