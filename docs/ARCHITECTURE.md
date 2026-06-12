# 🏗️ 시스템 아키텍처

**작성일**: 2024-05-21  
**버전**: 2.0 (코드 정합 정정)  
**상태**: 구현 반영 (코드가 정본 — 과거 설계 의도와 다른 부분 정정)

---

## 📋 **목차**

1. [전체 아키텍처](#전체-아키텍처)
2. [컴포넌트 설명](#컴포넌트-설명)
3. [데이터 흐름](#데이터-흐름)
4. [기술 스택](#기술-스택)
5. [배포 구조](#배포-구조)
6. [확장성 전략](#확장성-전략)

---

## 🌍 **전체 아키텍처**

```
┌─────────────────────────────────────────────────────────────┐
│                     사용자 (클라이언트)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              프론트엔드 (React 19 · CRA · 순수 CSS)            │
│  - 7화면: 홈/비교/추천/뉴스/깃헙트렌드/벤치마크/상세           │
│  - 홈 검색·필터(이름·설명·카테고리·태그), 공용 비교 트레이     │
│  - Zustand 상태 · services/api.js 경유 호출                   │
└────────────────┬─────────────────────────────────────────────┘
                 │ (HTTP/HTTPS)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│       백엔드 (FastAPI · raw SQL, ORM 모델 없음 · Railway)     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Routers (app/routers/)                             │ │
│  │ - /api/tools                                           │ │
│  │ - /api/recommendations                                 │ │
│  │ - /api/compare                                         │ │
│  │ - /api/news                                            │ │
│  │ - /api/benchmarks                                      │ │
│  │ - /api/trends (깃헙 트렌딩)                            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ app/{main,database,auth,exceptions}.py                 │ │
│  │ - SQLAlchemy text() :name 파라미터 바인딩              │ │
│  │ - 인메모리 레이트리밋 · CORS(ALLOWED_ORIGINS)         │ │
│  │ - 응답 포맷 {success, data, error}                     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────┬─────────────────────────────────────────────┘
                 │ (raw SQL)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│            PostgreSQL Database (Render)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Tables (7개)                                           │ │
│  │ - tools           (78행)                               │ │
│  │ - pricing         (>0)                                 │ │
│  │ - tags            (19: task 11·profession 8)           │ │
│  │ - tool_tags       (≈312)                               │ │
│  │ - benchmarks      (24: LLM 9개)                        │ │
│  │ - news            (0행 시작 → cron 수집 점등)          │ │
│  │ - github_trending (0행 시작 → cron 수집 점등)          │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│        데이터 수집 (collectors/ + collect.py)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ collectors/                                            │ │
│  │ - base.py            (공용 기반)                       │ │
│  │ - rss.py             (뉴스 RSS)                        │ │
│  │ - github.py          (리포 통계)                       │ │
│  │ - producthunt.py     (Product Hunt)                    │ │
│  │ - github_trending.py (깃헙 트렌딩)                     │ │
│  │ - translate.py       (MyMemory 무료 번역 백필)         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 실행                                                   │ │
│  │ - collect.py (엔트리, --backfill-translations 옵션)    │ │
│  │ - .github/workflows/collect.yml (매일 0 0 * * * cron)  │ │
│  │ - scheduler.py (APScheduler, 기본 비활성)              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 **컴포넌트 설명**

### **1. 프론트엔드 (Frontend Layer)**

**역할**: 사용자 인터페이스 제공

**주요 기능**:
- 7화면: 홈 / 비교 / 추천 / 뉴스 / 깃헙트렌드(/trends/github) / 벤치마크 / 상세(/details/:id)
- 홈 검색(300ms 디바운스, 이름·설명·카테고리·태그 매칭) · 필터 · 공용 비교 트레이(`CompareTray`)
- 도구 검색 & 필터링, 비교, 맞춤 추천, 뉴스/트렌드 피드

**기술**:
- React 19
- CRA (react-scripts)
- 순수 CSS (Tailwind 아님)
- Zustand (상태관리)
- Axios (HTTP 클라이언트, services/api.js 경유)
- react-router-dom v7

**배포**:
- Vercel (자동 배포)
- CDN: Vercel Edge Network

---

### **2. 백엔드 (Backend Layer)**

**역할**: 비즈니스 로직 처리 및 API 제공

**구조**:

> 실제 구조는 raw SQL 기반이다. ORM 모델(models/) · Pydantic 스키마(schemas/) · 서비스 계층(services/) · config.py 는 없다.

```
backend/
├── app/
│   ├── main.py            # FastAPI 앱 정의 · CORS · 레이트리밋 · 라우터 등록
│   ├── database.py        # DB 연결 (SQLAlchemy text() raw SQL)
│   ├── auth.py            # 인증
│   ├── exceptions.py      # 공용 예외 패턴
│   ├── trends_themes.py   # 트렌드 테마 보조
│   └── routers/
│       ├── tools.py           # /api/tools
│       ├── recommendations.py # /api/recommendations
│       ├── compare.py         # /api/compare
│       ├── news.py            # /api/news
│       ├── benchmarks.py      # /api/benchmarks
│       └── trends.py          # /api/trends (깃헙 트렌딩)
├── collectors/            # 수집 파이프라인 (base/rss/github/producthunt/github_trending/translate)
├── collect.py             # 수집 엔트리
├── scheduler.py           # APScheduler (기본 비활성)
├── bootstrap.py           # 멱등 부트스트랩 오케스트레이터
├── init_db.py             # schema.sql 적용
├── load_tools_fixed.py    # 도구 적재
├── seed_tags.py           # tags + tool_tags 적재
└── seed_benchmarks.py     # benchmarks 적재
```

**주요 기능**:
- RESTful API 제공 (응답 포맷 `{success, data, error}`)
- raw SQL 접근 (SQLAlchemy `text()` + `:name` 파라미터 바인딩, ORM 모델 없음)
- 빈 데이터는 `success:true` + 빈 배열로 graceful, 도구 미존재는 404
- 에러 처리(exceptions.py) · 로깅

**특징**:
- 자동 문서화 (Swagger UI)
- 빠른 성능
- 비동기 처리 가능

---

### **3. 데이터베이스 (Data Layer)**

**타입**: PostgreSQL (관계형 데이터베이스)

**테이블 구조**:

```
tools (1)
├─── tool_tags (N) ──── tags
├─── benchmarks (N)
└─── pricing (N)

news              # 도구와 독립 (수집 적재)
github_trending   # 도구와 독립 (수집 적재)
```

**테이블 7개**: tools · pricing · benchmarks · tags · tool_tags · news · github_trending

**특징**:
- 정규화된 스키마
- 인덱싱으로 빠른 조회
- 외래키 제약으로 데이터 무결성

---

### **4. 데이터 수집 (Data Collection Layer)**

**역할**: 외부 소스에서 자동으로 데이터 수집. 초기 0행 → 수집 실행 시 점등.

**주요 컴포넌트** (`backend/collectors/`):

#### **RSS Collector (rss.py)**
```
뉴스 RSS 피드
        ↓
  파싱 / 정규화
        ↓
  news 테이블 insert
```

#### **GitHub Collector (github.py)**
```
GitHub API
        ↓
  리포 통계 fetch
        ↓
  도구 메타 보강
```

#### **GitHub Trending Collector (github_trending.py)**
```
GitHub Trending
        ↓
  품질 필터
        ↓
  github_trending 테이블 insert
```

#### **Product Hunt Collector (producthunt.py)**
```
Product Hunt
        ↓
  Extract Data
        ↓
  Database Insert/Update
```

#### **번역 백필 (translate.py)**
```
title / description
        ↓
  MyMemory (무료) 번역
        ↓
  title_ko / description_ko 백필
  (collect.py --backfill-translations)
```

**실행 스케줄**:
- `.github/workflows/collect.yml` GitHub Actions cron `0 0 * * *` (매일 00:00 UTC)
- `scheduler.py`(APScheduler)는 존재하나 기본 비활성

---

## 🔄 **데이터 흐름**

### **1. 초기 데이터 로드 (부트스트랩 — 멱등)**

```
backend/bootstrap.py 순서:
1. init_db.py           → schema.sql 적용 (7개 테이블)
2. load_tools_fixed.py  → tools 78행 + pricing
3. seed_tags.py         → tags 19 + tool_tags ≈312 (tags_seed.json)
4. seed_benchmarks.py   → benchmarks 24 (benchmarks_data.json, LLM 9개)

검증 기대치:
tools=78, pricing>0, tags=19, tool_tags=312,
benchmarks=24, news=0, github_trending=0
```

### **2. 정기 수집 업데이트**

```
[매일 00:00 UTC — GitHub Actions cron]
1. collect.py 실행 (collectors/ 호출)
2. 뉴스(RSS) → news 테이블
3. 깃헙 트렌딩 → github_trending 테이블
4. (옵션) --backfill-translations 로 한국어 백필
```

### **3. 사용자 요청 처리**

```
[사용자 접근]
1. 프론트엔드 → FastAPI /api/tools?filters
2. 백엔드 → SQL Query
3. 데이터베이스 → 결과 반환
4. 백엔드 → JSON 응답
5. 프론트엔드 → UI 렌더링
```

---

## 🛠️ **기술 스택**

### **Frontend**
| 계층 | 기술 | 용도 |
|------|------|------|
| 언어 | JavaScript (TS 아님) | UI 로직 |
| 프레임워크 | React 19 | UI 구축 |
| 빌드 | CRA (react-scripts, Vite 아님) | 빌드 |
| 스타일 | 순수 CSS (Tailwind 아님) | 디자인 |
| 상태관리 | Zustand | 전역 상태 |
| HTTP | Axios (services/api.js 경유) | API 통신 |
| 라우팅 | react-router-dom v7 | 페이지 전환 |

### **Backend**
| 계층 | 기술 | 용도 |
|------|------|------|
| 언어 | Python 3.9+ | 서버 |
| 프레임워크 | FastAPI | API 개발 |
| DB 접근 | SQLAlchemy `text()` raw SQL (ORM 모델 없음) | 쿼리 |
| 바인딩 | `:name` 파라미터 (SQLi 방지) | 안전 쿼리 |
| 비동기 | asyncio | 비동기 처리 |

### **Data Collection**
| 라이브러리 | 용도 |
|-----------|------|
| requests | HTTP 요청 |
| feedparser | RSS 파싱 |
| MyMemory (무료 번역) | title_ko/description_ko 백필 |
| APScheduler | 스케줄링 (기본 비활성, 운영은 Actions cron) |

### **Database**
| 기술 | 용도 |
|------|------|
| PostgreSQL | 관계형 DB |
| psycopg2 | DB 드라이버 |

### **DevOps & Hosting**
| 서비스 | 용도 |
|--------|------|
| Railway | Backend 호스팅 |
| Render | PostgreSQL 호스팅 |
| Vercel | Frontend 호스팅 |
| GitHub Actions | CI(ci.yml) · 수집 cron(collect.yml) |

---

## 🚀 **배포 구조**

### **Development 환경**

```
Local Machine
├── Frontend: npm start (http://localhost:3000)
├── Backend: uvicorn (http://localhost:8000)
└── Database: PostgreSQL local
```

### **Production 환경**

```
┌─────────────┐        ┌──────────────┐
│  Vercel     │  HTTP  │  Railway     │
│ (Frontend)  │ ─────▶ │  (Backend)   │
│ React 19    │        │  FastAPI App │
└─────────────┘        └──────┬───────┘
                              │ (raw SQL)
                         ┌────▼─────┐
                         │PostgreSQL │
                         │ (Render)  │
                         └───────────┘

GitHub Actions (collect.yml, 매일 cron) ──▶ Railway/DB 수집 적재

CORS: ALLOWED_ORIGINS 화이트리스트, allow_credentials=False
```

### **배포 프로세스**

```
[Frontend]
1. GitHub commit
2. Vercel 자동 감지
3. Build & Deploy
4. Live in 1-2 분

[Backend]
1. GitHub commit
2. Railway 자동 감지
3. Build & Deploy (모듈은 app/ 안 + 상대 import — top-level import는 기동 크래시)
4. Live in 2-3 분

[Database]
1. PostgreSQL은 Render 호스팅
2. 스키마/데이터: bootstrap.py 멱등 실행
   (init_db → load_tools_fixed → seed_tags → seed_benchmarks)
```

---

## 📈 **확장성 전략**

### **Phase 1: MVP (현재)**
- 100개 도구
- 주 1회 업데이트
- 단일 백엔드 인스턴스

### **Phase 2: 스케일링**
- 500개 도구
- 일 1회 업데이트
- 백엔드 자동 스케일 (Railway)
- 캐싱 추가 (Redis)

```
FastAPI + Gunicorn
        ↓
    Load Balancer
    ├── Worker 1
    ├── Worker 2
    └── Worker 3
        ↓
    PostgreSQL (Connection Pool)
```

### **Phase 3: 고도화**
- 1000개+ 도구
- 실시간 업데이트
- 마이크로서비스 아키텍처

```
API Gateway
├── Tools Service
├── Recommendations Service
├── News Service
└── Comparison Service
    ↓
    Message Queue (Redis/RabbitMQ)
    ↓
    PostgreSQL + Cache Layer
```

---

## 🔒 **보안**

### **백엔드**
- CORS: ALLOWED_ORIGINS 화이트리스트(와일드카드 아님), allow_credentials=False
- Rate Limiting: 인메모리 적용 (다중 워커 환경 한계 잔존)
- 환경변수로 민감 정보 관리 (하드코딩 시크릿 없음)
- SQL Injection 방지: SQLAlchemy `text()` + `:name` 파라미터 바인딩

### **데이터**
- HTTPS 암호화
- DB 백업 (Render 자동)
- 접근 제어 (환경변수)

### **모니터링**
- 로깅 및 에러 추적
- Sentry (선택사항)

---

## 🔄 **CI/CD Pipeline**

```
┌─────────────┐
│  Developer  │
│  Push Code  │
└──────┬──────┘
       │ (Git Push)
       ▼
┌──────────────────┐
│  GitHub Actions  │ (.github/workflows/)
├──────────────────┤
│ ci.yml: 검증     │
│ collect.yml:     │
│   매일 수집 cron │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Production      │
│  Environment     │
└──────────────────┘
```

---

## 📊 **성능 지표**

### **Backend**
- API 응답시간: < 200ms
- 동시 사용자: 100+
- 가용성: 99.9%

### **Database**
- 쿼리 응답시간: < 50ms
- 연결 풀 크기: 20
- 백업: 일 1회

### **Frontend**
- 페이지 로딩: < 3초
- Lighthouse Score: > 90

---

## 🎯 **설계 원칙**

1. **단순성**: 처음엔 단순하게 시작
2. **확장성**: 나중에 확장할 수 있도록 설계
3. **유지보수성**: 코드는 명확하고 문서화됨
4. **신뢰성**: 에러 처리와 로깅 중요
5. **보안**: 데이터와 API는 보호됨

---

**마지막 업데이트**: 2026-05-31 (코드 정합 정정 — 스택/구조/데이터/배포 토폴로지)  
**리뷰 주기**: 매달

> 미확정: 운영(Render) DB가 실제로 bootstrap 됐는지는 라이브 확인 필요(세션로그상 점등 정황). news/github_trending은 0행 시작이라 cron 수집 후 점등.
