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
