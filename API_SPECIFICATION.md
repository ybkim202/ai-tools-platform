# 📡 API 명세

**Base URL**: `http://localhost:8000/api` (개발환경)  
**API Version**: v1  
**인증**: 현재 필요 없음 (향후 추가)

---

## 📋 **목차**

1. [Tools (도구)](#tools-도구)
2. [Benchmarks (벤치마크)](#benchmarks-벤치마크)
3. [Pricing (가격)](#pricing-가격)
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
| `sort_by` | string | ❌ | 정렬 기준 | `popularity`, `rating`, `price`, `recent` |
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
    "benchmarks": [
      {
        "id": 1,
        "benchmark_type": "속도",
        "score": 85,
        "source": "공식벤치마크",
        "collected_date": "2024-05-15T00:00:00Z"
      },
      {
        "id": 2,
        "benchmark_type": "정확도",
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
| `benchmark_type` | string | ❌ | 벤치마크 종류 (속도, 정확도, 비용효율, 사용성) |
| `sort_by` | string | ❌ | 정렬 기준 (`score_desc`, `score_asc`, `recent`) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 1,
      "tool_name": "ChatGPT",
      "benchmark_type": "속도",
      "score": 85,
      "source": "공식벤치마크",
      "collected_date": "2024-05-15T00:00:00Z"
    }
  ]
}
```

---

## 💰 **Pricing (가격)**

### **GET /pricing**

가격 정보를 조회합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구의 가격만 |
| `billing_period` | string | ❌ | 청구 기간 (monthly, annual, onetime, free) |

**응답 (200 OK)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tool_id": 1,
      "tool_name": "ChatGPT",
      "plan_name": "프로",
      "price": 20,
      "currency": "USD",
      "billing_period": "monthly",
      "description": "고급 기능 포함"
    }
  ]
}
```

---

## 📰 **News (뉴스)**

### **GET /news**

최신 뉴스와 업데이트를 조회합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `tool_id` | number | ❌ | 특정 도구의 뉴스만 |
| `days` | number | ❌ | 최근 N일 이내 (기본값: 30) |
| `limit` | number | ❌ | 최대 결과 수 (기본값: 20) |

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

---

## 🎁 **Recommendations (추천)**

### **GET /recommendations**

맞춤 추천을 받습니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `task` | string | ❌ | 업무 (콘텐츠작성, 이미지생성 등) | `콘텐츠작성` |
| `profession` | string | ❌ | 직업 (개발자, 디자이너 등) | `개발자` |
| `limit` | number | ❌ | 추천 개수 (기본값: 5) | `10` |

**응답 (200 OK)**

```json
{
  "success": true,
  "query": {
    "task": "콘텐츠작성",
    "profession": "마케터"
  },
  "data": [
    {
      "id": 1,
      "name": "ChatGPT",
      "reason": "콘텐츠 작성에 최고 인기 도구",
      "score": 95
    },
    {
      "id": 5,
      "name": "Claude",
      "reason": "마케터들이 많이 사용",
      "score": 90
    }
  ]
}
```

**예시 요청**

```bash
curl "http://localhost:8000/api/recommendations?task=콘텐츠작성&profession=마케터&limit=5"
```

---

## ⚖️ **Compare (비교)**

### **GET /compare**

여러 도구를 비교합니다.

**요청 파라미터**

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `ids` | string | ✅ | 비교할 도구 ID들 (쉼표로 구분) |
| `fields` | string | ❌ | 비교할 필드 (기본값: 모두) |

**응답 (200 OK)**

```json
{
  "success": true,
  "comparison": [
    {
      "id": 1,
      "name": "ChatGPT",
      "category": "생성형AI",
      "price_min": 0,
      "price_max": 20,
      "user_count": 100000000,
      "benchmarks": {
        "속도": 85,
        "정확도": 92,
        "비용효율": 78
      }
    },
    {
      "id": 2,
      "name": "Claude",
      "category": "생성형AI",
      "price_min": 0,
      "price_max": 20,
      "user_count": 50000000,
      "benchmarks": {
        "속도": 88,
        "정확도": 95,
        "비용효율": 82
      }
    }
  ]
}
```

**예시 요청**

```bash
curl "http://localhost:8000/api/compare?ids=1,2,3"
```

---

## ❌ **에러 처리**

### **에러 응답 형식**

```json
{
  "success": false,
  "error": {
    "code": "TOOL_NOT_FOUND",
    "message": "요청한 도구를 찾을 수 없습니다."
  }
}
```

### **일반적인 에러 코드**

| 상태코드 | 에러코드 | 설명 |
|---------|---------|------|
| 400 | INVALID_PARAMS | 잘못된 파라미터 |
| 404 | NOT_FOUND | 리소스를 찾을 수 없음 |
| 500 | INTERNAL_ERROR | 서버 에러 |

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
  benchmark_type: "속도" | "정확도" | "비용효율" | "사용성"
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
**마지막 업데이트**: 2024-05-21
