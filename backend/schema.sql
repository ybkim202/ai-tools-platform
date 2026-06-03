-- AITools 데이터베이스 스키마 정본(single source of truth)
--
-- 목적
--   빈 PostgreSQL DB 를 레포만으로 재현 가능하게 세운다. 과거에는 테이블이
--   레포 밖에서 수동 생성되어(pgAdmin/psql) 재현이 불가능했다 — 이 파일이 그 공백을 메운다.
--
-- 적용
--   backend/init_db.py 가 이 파일을 읽어 단일 트랜잭션으로 실행한다.
--     DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python init_db.py
--   (psql 로도 적용 가능: psql "$DATABASE_URL" -f schema.sql)
--
-- 멱등성
--   모든 DDL 은 CREATE TABLE/INDEX IF NOT EXISTS 라 여러 번 실행해도 안전하다.
--
-- 적재 순서(데이터)
--   schema.sql → load_tools_fixed.py(tools/pricing) → seed_tags.py(tags/tool_tags).
--   FK 의존성 때문에 tools 가 가장 먼저 존재해야 한다(아래 작성 순서가 곧 보장).

-- ==================== tools (루트 엔터티) ====================
CREATE TABLE IF NOT EXISTS tools (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL UNIQUE,
    logo_url          TEXT,
    official_url      TEXT,
    description       TEXT,
    category          VARCHAR(100),
    country           VARCHAR(100),
    difficulty        VARCHAR(50),
    user_count        BIGINT,
    user_count_source VARCHAR(255),
    user_count_date   TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 자동 갱신/발견 컬럼(nullable). 운영 중 DB 에도 ADD COLUMN IF NOT EXISTS 로 멱등 보강한다
-- (init_db.py 가 schema.sql 을 재실행하면 기존 DB 에도 컬럼이 생긴다. Postgres 9.6+).
-- news 의 title_ko 패턴과 동일 — 코드가 새 컬럼을 쓰기 전에 이 마이그레이션을 먼저 적용해야 한다.
--
-- 인기지표는 소스 중립적으로 분리 저장한다(GitHub stars 와 HN points 는 스케일이 달라
-- 단일 컬럼으로 합치면 정렬이 왜곡되므로 합치지 않는다). 자동 갱신은 "검증 가능한 공식
-- 소스"만 대상으로 하며, user_count(출처 불명확)는 절대 자동 덮어쓰지 않는다(수동 유지).
--   github_repo       : "owner/repo"(오픈소스 도구만, SaaS 는 NULL). stars 갱신 키.
--   github_stars      : GitHub Repo API stargazers_count 스냅샷.
--   hn_object_id      : Hacker News story ID(자동 발견 도구의 멱등키 겸 points 재갱신 키).
--   hn_points         : Hacker News points 스냅샷(자동 발견 도구의 인기지표).
--   metrics_synced_at : 인기지표 마지막 동기화 시각.
--   source            : 출처 추적. 'manual'(기존 78개·수동) | 'auto_hn' | 'auto_github'.
--                       게이트가 아니라 추적/롤백용(자동 공개 정책) — 기본값 'manual'.
ALTER TABLE tools ADD COLUMN IF NOT EXISTS github_repo       VARCHAR(255);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS github_stars      INTEGER;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS hn_object_id      VARCHAR(20);
ALTER TABLE tools ADD COLUMN IF NOT EXISTS hn_points         INTEGER;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS metrics_synced_at TIMESTAMP;
ALTER TABLE tools ADD COLUMN IF NOT EXISTS source            VARCHAR(30) NOT NULL DEFAULT 'manual';

-- 자동 발견 도구 멱등키: 같은 HN story 는 1행만(부분 인덱스, hn_object_id 있는 행만).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tools_hn_object_id ON tools(hn_object_id)
    WHERE hn_object_id IS NOT NULL;

-- 벤치마크 자동수집(Phase B) — LMArena 미러로 대화선호 Elo 를 자동 갱신할 때 쓰는
-- 도구↔공급사 매핑. 값은 LMArena vendor 식별자(예 'OpenAI','Anthropic','Google').
-- collector 가 해당 vendor 의 최고 Elo 모델을 그 도구의 LMArena Elo 로 매핑한다(모델
-- 식별자가 자주 바뀌어도 강건). NULL 이면 자동수집 대상 아님(수동 점수만). 멱등 보강.
ALTER TABLE tools ADD COLUMN IF NOT EXISTS representative_model VARCHAR(60);

-- ==================== pricing (tools 1:N) ====================
-- billing_period 는 load_tools_fixed.validate_billing_period() 가 보장하는 4값만 허용.
CREATE TABLE IF NOT EXISTS pricing (
    id             SERIAL PRIMARY KEY,
    tool_id        INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    plan_name      TEXT,
    price          NUMERIC(10, 2),
    currency       VARCHAR(3),
    billing_period VARCHAR(50) NOT NULL
        CHECK (billing_period IN ('monthly', 'annual', 'onetime', 'free')),
    description    TEXT
);
CREATE INDEX IF NOT EXISTS idx_pricing_tool_id ON pricing(tool_id);

-- ==================== benchmarks (tools 1:N) ====================
CREATE TABLE IF NOT EXISTS benchmarks (
    id             SERIAL PRIMARY KEY,
    tool_id        INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    benchmark_type VARCHAR(100) NOT NULL,
    score          NUMERIC(12, 4) NOT NULL,
    source         VARCHAR(255),
    collected_date TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_benchmarks_tool_id ON benchmarks(tool_id);
CREATE INDEX IF NOT EXISTS idx_benchmarks_collected_date ON benchmarks(collected_date);

-- 카테고리별 다양화 컬럼(nullable, 운영 중 DB 에도 ADD COLUMN IF NOT EXISTS 로 멱등 보강).
-- news.title_ko 패턴과 동일 — 코드(seed/라우터)가 새 컬럼을 쓰기 전에 먼저 적용해야 한다.
--   category      : 추론/코딩/수학/멀티모달/선호/종합 — 벤치마크 페이지 카테고리 섹션 그룹핑 키.
--   model_version : 어느 모델 점수인지(예 "Claude Opus 4.5", "GPT-5.1"). source 에 묻힌 정보를 정형화.
--   unit          : 'percent'(0~100) | 'elo'(LMArena ~1000-1400). score 스케일 구분 — 표시·정규화 근거.
-- score 는 NUMERIC(12,4)라 Elo(정수)도 그대로 수용한다(별도 scale 컬럼 불필요).
-- 기존 행은 unit DEFAULT 'percent' 로 자동 후방호환(기존 벤치는 전부 % 척도였음).
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS category      VARCHAR(50);
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS model_version VARCHAR(120);
ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS unit          VARCHAR(20) NOT NULL DEFAULT 'percent';
CREATE INDEX IF NOT EXISTS idx_benchmarks_category ON benchmarks(category);

-- ==================== news (tools 1:N) ====================
-- collected_date 는 news 라우터의 "최근 N일" 필터/정렬 핵심 컬럼.
CREATE TABLE IF NOT EXISTS news (
    id             SERIAL PRIMARY KEY,
    tool_id        INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    title          TEXT NOT NULL,
    content        TEXT,
    news_date      TIMESTAMP,
    source_url     VARCHAR(500),
    collected_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_news_collected_date ON news(collected_date);
CREATE INDEX IF NOT EXISTS idx_news_tool_id_collected_date ON news(tool_id, collected_date);

-- 한글 번역 컬럼(nullable). 이미 운영 중인 DB 는 CREATE TABLE IF NOT EXISTS 로는
-- 컬럼이 추가되지 않으므로, ADD COLUMN IF NOT EXISTS 로 멱등하게 보강한다.
-- (init_db.py 가 schema.sql 을 재실행하면 기존 DB 에도 컬럼이 생긴다. Postgres 9.6+ 지원.)
-- title_ko/summary_ko 는 무료 MyMemory 번역 API(키 불필요)로 채워지고,
-- 네트워크/쿼터 실패 시 NULL 로 남는다(원문 title/content 는 항상 유지).
ALTER TABLE news ADD COLUMN IF NOT EXISTS title_ko   TEXT;
ALTER TABLE news ADD COLUMN IF NOT EXISTS summary_ko TEXT;

-- ==================== github_trending (독립 트렌드 테이블) ====================
-- GET /api/trends/github 의 데이터 소스. tools 와 무관한 독립 엔터티이므로 FK 없음.
-- 수집기(collectors/github_trending.py)가 period(weekly/monthly)별로 멱등 교체한다.
--   멱등 키: UNIQUE(repo_full_name, period) — 같은 레포/기간은 1행만 유지(upsert).
-- topics 는 GitHub 가 준 토픽 배열을 JSONB 로 그대로 저장(라우터가 Python 에서
--   테마 매핑에 사용). description_ko 는 무료 MyMemory 번역(키 불필요), 실패 시 NULL.
-- rank 는 별점 내림차순 순위(1=최고). collected_date 는 신선도(라우터 collected_at).
CREATE TABLE IF NOT EXISTS github_trending (
    id              SERIAL PRIMARY KEY,
    repo_full_name  VARCHAR(255) NOT NULL,
    owner           VARCHAR(255),
    repo            VARCHAR(255),
    name            VARCHAR(255),
    description     TEXT,
    description_ko  TEXT,
    html_url        VARCHAR(500),
    avatar_url      VARCHAR(500),
    stars           INTEGER,
    forks           INTEGER,
    language        VARCHAR(100),
    topics          JSONB,
    repo_created_at TIMESTAMP,
    period          VARCHAR(10) NOT NULL,
    rank            INTEGER,
    collected_date  TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (repo_full_name, period)
);
CREATE INDEX IF NOT EXISTS idx_github_trending_period_rank ON github_trending(period, rank);
CREATE INDEX IF NOT EXISTS idx_github_trending_period_collected ON github_trending(period, collected_date);

-- ==================== events (전환 추적, 독립 엔터티) ====================
-- POST /api/events 의 저장 대상. About 페이지 CTA 클릭 등 1st-party 전환 계측.
-- tools 와 무관한 독립 엔터티이므로 FK 없음.
-- 개인정보 미수집(헌법 G9): IP/User-Agent 등 식별 정보는 저장하지 않는다.
--   라우터는 request.client.host / User-Agent 헤더를 읽지 않는다.
-- name/target 은 라우터가 화이트리스트/정규식(^[a-z0-9_]{1,40}$)으로 검증한 값만 INSERT.
-- referrer 는 nullable(프론트는 현재 미전송 — 향후 확장 여지만 둔다).
-- created_at 에만 인덱스(시계열 조회용). 운영 중 DB 에도 IF NOT EXISTS 로 안전 적용.
CREATE TABLE IF NOT EXISTS events (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(40) NOT NULL,
    target     VARCHAR(40) NOT NULL,
    path       VARCHAR(256) NOT NULL,
    referrer   VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- ==================== tags / tool_tags (추천 기능) ====================
-- 정본은 여기다. seed_tags.py 에도 동일 DDL 이 방어적으로 존재한다
-- (seed_tags.py 단독 실행 보장용). 둘 중 하나를 바꾸면 반드시 양쪽을 동기화할 것.
CREATE TABLE IF NOT EXISTS tags (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('task', 'profession')),
    UNIQUE (name, type)
);

CREATE TABLE IF NOT EXISTS tool_tags (
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (tool_id, tag_id)
);
