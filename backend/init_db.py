"""DB 스키마 초기화 스크립트 — schema.sql 을 읽어 실행한다.

목적
----
빈 PostgreSQL DB 에 AITools 의 7개 테이블(tools, pricing, benchmarks, news,
github_trending, tags, tool_tags)과 인덱스를 만든다. SQL 본문은 `schema.sql` 한 곳에만 두고,
이 모듈은 그 파일을 읽어 단일 트랜잭션으로 실행하는 얇은 러너다.

멱등성(재실행 안전)
-------------------
schema.sql 의 모든 DDL 은 CREATE TABLE/INDEX IF NOT EXISTS 라
여러 번 실행해도 동일 상태로 수렴한다.

보안(헌법 G9)
-------------
크리덴셜은 절대 하드코딩하지 않는다. 접속정보는 환경변수 `DATABASE_URL`
로만 주입한다. 미설정 시 즉시 종료한다.

실행 방법
---------
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python init_db.py

실행 순서(중요)
---------------
1) python init_db.py          → 7개 테이블/인덱스 생성
2) python load_tools_fixed.py → tools/pricing 적재
3) python seed_tags.py        → tags/tool_tags 적재
(또는 python bootstrap.py 로 위 세 단계를 한 번에)
"""

import os

import psycopg2

# 접속정보는 환경변수로만 주입한다(seed_tags.py / load_tools_fixed.py 와 동일 패턴).
# NEVER: 접속 문자열(비밀번호 포함)을 소스에 하드코딩하지 않는다(헌법 G9).
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise SystemExit(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python init_db.py"
    )

# schema.sql 은 이 파일과 같은 디렉토리에 있다(cwd 와 무관하게 절대경로로 읽는다).
SCHEMA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

# 검증용 — schema.sql 이 생성하는 테이블 목록.
EXPECTED_TABLES = (
    "tools",
    "pricing",
    "benchmarks",
    "news",
    "github_trending",
    "events",
    "tags",
    "tool_tags",
)


def load_schema(path: str = SCHEMA_FILE) -> str:
    """schema.sql 내용을 문자열로 읽는다.

    Raises:
        SystemExit: 파일이 없는 경우.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        raise SystemExit(f"❌ 스키마 파일을 찾을 수 없습니다: {path}")


def verify(cursor) -> list:
    """EXPECTED_TABLES 가 실제로 존재하는지 확인해 누락 목록을 반환한다."""
    cursor.execute(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema = 'public'"
    )
    present = {row[0] for row in cursor.fetchall()}
    return [t for t in EXPECTED_TABLES if t not in present]


def main() -> None:
    """메인 실행: 스키마 로드 → 실행 → 검증 → commit/rollback."""
    print("=" * 60)
    print("🗂️  DB 스키마 초기화 (schema.sql)")
    print("=" * 60)

    # 1) 스키마 SQL 로드(DB 연결 전).
    print("\n[1단계] schema.sql 로드")
    schema_sql = load_schema()
    print(f"✅ 스키마 로드 완료: {SCHEMA_FILE}")

    # 2) DB 연결.
    print("\n[2단계] 데이터베이스 연결")
    conn = psycopg2.connect(DATABASE_URL)
    print("✅ PostgreSQL 연결 성공")

    cursor = conn.cursor()
    try:
        # 3) 스키마 실행(psycopg2 는 세미콜론 구분 다중 DDL 을 한 execute 로 처리).
        print("\n[3단계] 스키마 실행(CREATE TABLE/INDEX IF NOT EXISTS)")
        cursor.execute(schema_sql)

        # 4) 검증.
        print("\n[4단계] 테이블 존재 검증")
        missing = verify(cursor)

        # 전체 성공 시에만 commit.
        conn.commit()

        if missing:
            # IF NOT EXISTS 라 정상 경로에선 발생하지 않지만 방어적으로 보고.
            print(f"⚠️  누락된 테이블: {', '.join(missing)}")
        else:
            print(f"✅ {len(EXPECTED_TABLES)}개 테이블 모두 존재: {', '.join(EXPECTED_TABLES)}")
        print("\n✅ 스키마 초기화 완료(commit)!")

    except Exception as e:
        # 예외 시 전체 rollback(부분 적용 방지).
        conn.rollback()
        print(f"\n❌ 스키마 초기화 실패, 롤백했습니다: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
