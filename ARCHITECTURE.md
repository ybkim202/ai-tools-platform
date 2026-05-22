# 🏗️ 시스템 아키텍처

**작성일**: 2024-05-21  
**버전**: 1.0  
**상태**: 설계 완료, 구현 예정

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
│                    프론트엔드 (React)                          │
│  - 도구 탐색, 필터링, 비교                                    │
│  - 맞춤 추천                                                  │
│  - 뉴스 피드                                                  │
└────────────────┬─────────────────────────────────────────────┘
                 │ (HTTP/HTTPS)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│            백엔드 (FastAPI)                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ API Routers                                            │ │
│  │ - /api/tools (GET, POST)                              │ │
│  │ - /api/benchmarks (GET)                               │ │
│  │ - /api/pricing (GET)                                  │ │
│  │ - /api/news (GET)                                     │ │
│  │ - /api/recommendations (GET)                          │ │
│  │ - /api/compare (GET)                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Business Logic                                         │ │
│  │ - Tool Management                                      │ │
│  │ - Recommendation Engine                               │ │
│  │ - Data Validation                                      │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────┬─────────────────────────────────────────────┘
                 │ (SQL)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│            PostgreSQL Database (Render)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Tables                                                 │ │
│  │ - tools                                                │ │
│  │ - tags                                                 │ │
│  │ - tool_tags                                            │ │
│  │ - benchmarks                                           │ │
│  │ - pricing                                              │ │
│  │ - news                                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│        데이터 수집 (Automated Scripts)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Python Scripts (APScheduler)                           │ │
│  │ - Product Hunt Collector                              │ │
│  │ - GitHub Collector                                     │ │
│  │ - Web Scraper                                          │ │
│  │ - RSS Feed Aggregator                                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ External APIs                                          │ │
│  │ - Product Hunt API                                     │ │
│  │ - GitHub API                                           │ │
│  │ - Official Websites                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔧 **컴포넌트 설명**

### **1. 프론트엔드 (Frontend Layer)**

**역할**: 사용자 인터페이스 제공

**주요 기능**:
- 도구 검색 & 필터링
- 비교 기능
- 맞춤 추천
- 뉴스 피드

**기술**:
- React 18
- Tailwind CSS
- Zustand (상태관리)
- Axios (HTTP 클라이언트)

**배포**:
- Vercel (자동 배포)
- CDN: Vercel Edge Network

---

### **2. 백엔드 (Backend Layer)**

**역할**: 비즈니스 로직 처리 및 API 제공

**구조**:

```
app/
├── main.py              # FastAPI 앱 정의
├── config.py            # 설정 (DB URL, API KEY 등)
├── models/
│   ├── tool.py
│   ├── benchmark.py
│   ├── pricing.py
│   └── news.py          # SQLAlchemy ORM 모델
├── schemas/
│   ├── tool.py
│   ├── benchmark.py
│   └── ...              # Pydantic 검증 스키마
├── routers/
│   ├── tools.py         # /api/tools
│   ├── benchmarks.py    # /api/benchmarks
│   ├── pricing.py       # /api/pricing
│   ├── news.py          # /api/news
│   ├── recommendations.py # /api/recommendations
│   └── compare.py       # /api/compare
├── services/
│   ├── tool_service.py
│   ├── recommendation_service.py
│   └── comparison_service.py
└── database.py          # 데이터베이스 연결
```

**주요 기능**:
- RESTful API 제공
- 데이터 검증 (Pydantic)
- 데이터베이스 ORM (SQLAlchemy)
- 에러 처리
- 로깅

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
├─── pricing (N)
└─── news (N)
```

**특징**:
- 정규화된 스키마
- 인덱싱으로 빠른 조회
- 외래키 제약으로 데이터 무결성

---

### **4. 데이터 수집 (Data Collection Layer)**

**역할**: 외부 소스에서 자동으로 데이터 수집

**주요 컴포넌트**:

#### **Product Hunt Collector**
```
Product Hunt API
        ↓
    GraphQL Query
        ↓
    Extract Data
        ↓
  Database Insert/Update
```

#### **GitHub Collector**
```
GitHub API
        ↓
  Fetch Repo Stats
        ↓
  Extract Stars, Last Commit
        ↓
  Update Benchmarks
```

#### **Web Scraper**
```
Official Websites
        ↓
  BeautifulSoup Parse
        ↓
  Extract Pricing, User Count
        ↓
  Database Update
```

#### **RSS Feed Aggregator**
```
Tool Blog RSS Feeds
        ↓
  feedparser Parse
        ↓
  Extract News
        ↓
  Insert into news table
```

**실행 스케줄**:
- 주 1회 (매주 월요일 00:00 UTC)
- APScheduler로 자동 실행

---

## 🔄 **데이터 흐름**

### **1. 초기 데이터 로드**

```
[Day 1]
1. Product Hunt에서 상위 100개 도구 수집
2. GitHub에서 관련 리포 정보 수집
3. 공식 웹사이트에서 가격/사용자수 크롤링
4. 벤치마크 데이터 수집
5. DB에 저장
```

### **2. 주간 업데이트**

```
[매주 월요일 00:00]
1. 기존 100개 도구 정보 갱신
2. 새로운 도구 감지 (Product Hunt)
3. 벤치마크 업데이트
4. 뉴스/트렌드 수집
5. DB 업데이트
6. Slack 알림
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
| 언어 | TypeScript | 타입 안정성 |
| 프레임워크 | React 18 | UI 구축 |
| 스타일 | Tailwind CSS | 디자인 |
| 상태관리 | Zustand | 전역 상태 |
| HTTP | Axios | API 통신 |
| 빌드 | Vite | 빠른 개발 |

### **Backend**
| 계층 | 기술 | 용도 |
|------|------|------|
| 언어 | Python 3.9+ | 서버 |
| 프레임워크 | FastAPI | API 개발 |
| ORM | SQLAlchemy | DB 객체 매핑 |
| 검증 | Pydantic | 데이터 검증 |
| 비동기 | asyncio | 비동기 처리 |

### **Data Collection**
| 라이브러리 | 용도 |
|-----------|------|
| requests | HTTP 요청 |
| BeautifulSoup4 | HTML 파싱 |
| feedparser | RSS 파싱 |
| APScheduler | 스케줄링 |

### **Database**
| 기술 | 용도 |
|------|------|
| PostgreSQL 15 | 관계형 DB |
| SQLAlchemy | ORM |
| psycopg2 | DB 드라이버 |

### **DevOps & Hosting**
| 서비스 | 용도 |
|--------|------|
| Render | Backend 호스팅 |
| Vercel | Frontend 호스팅 |
| GitHub | VCS & CI/CD |

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
┌─────────────────────────────────────────────┐
│          CloudFlare (CDN + DNS)              │
└────────────┬────────────────────────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  Vercel     │   │  Render      │
│ (Frontend)  │   │ (Backend)    │
│ React App   │   │ FastAPI App  │
└─────────────┘   └──────┬───────┘
                         │
                    ┌────▼─────┐
                    │PostgreSQL │
                    │(Render)   │
                    └───────────┘
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
2. Render 자동 감지
3. Build & Deploy
4. Live in 2-3 분

[Database]
1. Migration needed?
2. Render CLI: render migration
3. Schema 업데이트
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
- 백엔드 자동 스케일 (Render)
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
- CORS 설정 (프론트엔드만 허용)
- Rate Limiting (API 남용 방지)
- 환경변수로 민감 정보 관리
- SQL Injection 방지 (Parameterized Query)

### **데이터**
- HTTPS 암호화
- DB 백업 (Render 자동)
- 접근 제어 (환경변수)

### **모니터링**
- 로깅 및 에러 추적
- Sentry (선택사항)
- Slack 알림

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
│  GitHub Actions  │ (예정)
├──────────────────┤
│ 1. Lint & Format │
│ 2. Tests         │
│ 3. Build         │
│ 4. Deploy        │
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

**마지막 업데이트**: 2024-05-21  
**리뷰 주기**: 매달
