"""추천 기능용 태그(tags) / 도구-태그 매핑(tool_tags) 적재 스크립트.

목적
----
추천 라우터(`backend/app/routers/recommendations.py`)가 조인하는
`tags(id, name, type)` · `tool_tags(tool_id, tag_id)` 스키마를 보장하고,
`tags_seed.json` 의 데이터를 DB 에 적재한다.

멱등성(재실행 안전)
-------------------
이 스크립트는 **여러 번 실행해도 동일한 최종 상태**가 되도록 설계됐다.
  - 테이블은 `CREATE TABLE IF NOT EXISTS` 로 보장한다.
  - tags 삽입은 `UNIQUE(name, type)` 제약 + `ON CONFLICT (name, type) DO NOTHING`.
  - tool_tags 삽입은 `PRIMARY KEY(tool_id, tag_id)` + `ON CONFLICT DO NOTHING`.
따라서 중복 행이 생기지 않으며, 이미 적재된 상태에서 재실행하면
"신규 0 / 스킵 N" 으로 수렴한다.

보안(헌법 G9)
-------------
크리덴셜은 절대 하드코딩하지 않는다. 접속정보는 환경변수
`DATABASE_URL` 로만 주입한다. 미설정 시 즉시 종료한다.

실행 방법
---------
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python seed_tags.py

실행 순서(중요)
---------------
1) `python load_tools_fixed.py`  → tools 테이블 적재 (tool_tags 가 참조함)
2) `python seed_tags.py`         → tags / tool_tags 적재
tools 가 먼저 적재돼 있지 않으면 매칭 실패한 tool_name 이 스킵된다.
"""

import json
import os

import psycopg2

# 접속정보는 환경변수로만 주입한다(load_tools_fixed.py 와 동일 패턴).
# NEVER: 접속 문자열(비밀번호 포함)을 소스에 하드코딩하지 않는다(헌법 G9).
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise SystemExit(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python seed_tags.py"
    )

SEED_FILE = "tags_seed.json"

# 멱등 테이블 보장 DDL.
# tags: UNIQUE(name, type) 가 tags 멱등 삽입의 근거.
# tool_tags: PRIMARY KEY(tool_id, tag_id) 가 매핑 멱등 삽입의 근거.
# type 은 CHECK 로 'task'|'profession' 만 허용(스키마 무결성).
DDL_TAGS = """
CREATE TABLE IF NOT EXISTS tags (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('task', 'profession')),
    UNIQUE (name, type)
)
"""

DDL_TOOL_TAGS = """
CREATE TABLE IF NOT EXISTS tool_tags (
    tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (tool_id, tag_id)
)
"""


def load_seed(filename: str = SEED_FILE) -> dict:
    """tags_seed.json 을 읽어 구조를 검증한 뒤 dict 로 반환한다.

    Args:
        filename: 시드 JSON 파일 경로.

    Returns:
        {"tags": [...], "tool_tags": [...]} 형태의 dict.

    Raises:
        SystemExit: 파일이 없거나 JSON 형식/구조가 잘못된 경우.
    """
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"❌ 시드 파일을 찾을 수 없습니다: {filename}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"❌ 시드 JSON 형식이 잘못되었습니다: {e}")

    # 구조 검증
    if not isinstance(data, dict):
        raise SystemExit("❌ 시드 최상위는 객체여야 합니다.")
    tags = data.get("tags")
    tool_tags = data.get("tool_tags")
    if not isinstance(tags, list) or not isinstance(tool_tags, list):
        raise SystemExit("❌ 'tags' 와 'tool_tags' 는 배열이어야 합니다.")

    for i, tag in enumerate(tags):
        if not isinstance(tag, dict) or "name" not in tag or "type" not in tag:
            raise SystemExit(f"❌ tags[{i}] 는 name/type 키를 가져야 합니다.")
        if tag["type"] not in ("task", "profession"):
            raise SystemExit(
                f"❌ tags[{i}] type 은 'task'|'profession' 이어야 합니다: {tag['type']}"
            )

    for i, mapping in enumerate(tool_tags):
        if (
            not isinstance(mapping, dict)
            or "tool_name" not in mapping
            or not isinstance(mapping.get("tags"), list)
        ):
            raise SystemExit(
                f"❌ tool_tags[{i}] 는 tool_name 과 tags(배열)을 가져야 합니다."
            )

    print(
        f"✅ 시드 로드 완료: tags {len(tags)}개, "
        f"tool_tags 매핑 {len(tool_tags)}개 도구"
    )
    return data


def ensure_tables(cursor) -> None:
    """tags / tool_tags 테이블을 멱등하게 보장한다."""
    cursor.execute(DDL_TAGS)
    cursor.execute(DDL_TOOL_TAGS)
    print("✅ 테이블 보장 완료(tags, tool_tags)")


def seed_tags(cursor, tags: list) -> tuple:
    """tags 를 멱등 삽입하고 (name, type) → id 매핑을 반환한다.

    ON CONFLICT (name, type) DO NOTHING 으로 중복 없이 삽입한다.
    삽입 후 전체를 다시 SELECT 해 매핑을 확보한다(RETURNING 은 충돌 시
    행을 돌려주지 않으므로 매핑 누락을 막기 위해 별도 SELECT 사용).

    Returns:
        (tag_id_map, inserted_count, skipped_count)
        - tag_id_map: {(name, type): id}
    """
    inserted = 0
    for tag in tags:
        # %s 파라미터 바인딩(psycopg2 정석). f-string 값 삽입 금지.
        cursor.execute(
            "INSERT INTO tags (name, type) VALUES (%s, %s) "
            "ON CONFLICT (name, type) DO NOTHING",
            (tag["name"], tag["type"]),
        )
        # rowcount 는 실제 삽입된 경우 1, 충돌로 스킵되면 0.
        inserted += cursor.rowcount

    # 시드에 포함된 태그들의 (name, type) → id 매핑을 SELECT 로 확보.
    tag_id_map = {}
    cursor.execute("SELECT id, name, type FROM tags")
    for tag_id, name, type_ in cursor.fetchall():
        tag_id_map[(name, type_)] = tag_id

    skipped = len(tags) - inserted
    print(f"✅ tags 삽입: 신규 {inserted}개 / 스킵(이미존재) {skipped}개")
    return tag_id_map, inserted, skipped


def _resolve_tag_id(tag_name: str, tag_id_map: dict):
    """태그명으로 tag_id 를 찾는다(task 우선, 없으면 profession).

    시드의 tool_tags 항목은 type 구분 없이 태그명만 나열하므로,
    동일 이름이 task/profession 양쪽에 없는 한 이름만으로 유일하게 결정된다.
    (현재 시드에는 이름 중복이 없다.)
    """
    if (tag_name, "task") in tag_id_map:
        return tag_id_map[(tag_name, "task")]
    if (tag_name, "profession") in tag_id_map:
        return tag_id_map[(tag_name, "profession")]
    return None


def seed_tool_tags(cursor, tool_tags: list, tag_id_map: dict) -> tuple:
    """tool_tags 매핑을 멱등 삽입한다.

    각 tool_name 을 tools 테이블에서 조회(없으면 경고 후 skip),
    각 태그명을 tag_id_map 으로 변환,
    ON CONFLICT DO NOTHING 으로 (tool_id, tag_id) 를 삽입한다.

    Returns:
        (mapped_count, missing_tools, missing_tags)
        - mapped_count: 신규로 삽입된 (tool_id, tag_id) 행 수
        - missing_tools: tools 에서 못 찾은 tool_name 목록
        - missing_tags: 매핑 못 한 (tool_name, tag_name) 목록
    """
    mapped = 0
    missing_tools = []
    missing_tags = []

    for mapping in tool_tags:
        tool_name = mapping["tool_name"]
        cursor.execute("SELECT id FROM tools WHERE name = %s", (tool_name,))
        row = cursor.fetchone()
        if row is None:
            missing_tools.append(tool_name)
            print(f"⚠️  tools 에 없는 도구라 skip: {tool_name}")
            continue
        tool_id = row[0]

        for tag_name in mapping.get("tags", []):
            tag_id = _resolve_tag_id(tag_name, tag_id_map)
            if tag_id is None:
                missing_tags.append((tool_name, tag_name))
                print(f"⚠️  매핑 불가 태그(시드 tags 누락): {tool_name} → {tag_name}")
                continue
            cursor.execute(
                "INSERT INTO tool_tags (tool_id, tag_id) VALUES (%s, %s) "
                "ON CONFLICT DO NOTHING",
                (tool_id, tag_id),
            )
            mapped += cursor.rowcount

    print(f"✅ tool_tags 삽입: 신규 매핑 {mapped}건")
    return mapped, missing_tools, missing_tags


def verify(cursor) -> tuple:
    """최종 tags / tool_tags 총 행수를 검증 조회한다."""
    cursor.execute("SELECT COUNT(*) FROM tags")
    tags_total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM tool_tags")
    tool_tags_total = cursor.fetchone()[0]
    return tags_total, tool_tags_total


def main() -> None:
    """메인 실행: 시드 로드 → 테이블 보장 → 적재 → 검증 → commit/rollback."""
    print("=" * 60)
    print("🏷️  추천용 태그 시드 적재 스크립트")
    print("=" * 60)

    # 1) 시드 로드 + 구조 검증(DB 연결 전).
    print("\n[1단계] 시드 로드")
    seed = load_seed(SEED_FILE)

    # 2) DB 연결.
    print("\n[2단계] 데이터베이스 연결")
    conn = psycopg2.connect(DATABASE_URL)
    print("✅ PostgreSQL 연결 성공")

    cursor = conn.cursor()
    try:
        # 3) 테이블 보장.
        print("\n[3단계] 테이블 보장")
        ensure_tables(cursor)

        # 4) tags 적재.
        print("\n[4단계] tags 적재")
        tag_id_map, tags_inserted, tags_skipped = seed_tags(cursor, seed["tags"])

        # 5) tool_tags 적재.
        print("\n[5단계] tool_tags 적재")
        mapped, missing_tools, missing_tags = seed_tool_tags(
            cursor, seed["tool_tags"], tag_id_map
        )

        # 6) 검증.
        print("\n[6단계] 검증")
        tags_total, tool_tags_total = verify(cursor)

        # 전체 성공 시에만 commit(멱등 트랜잭션).
        conn.commit()

        # 7) 요약 출력.
        print("\n" + "=" * 60)
        print("📊 적재 요약")
        print("=" * 60)
        print(f"   - tags 신규/스킵 : {tags_inserted} / {tags_skipped}")
        print(f"   - tool_tags 신규 매핑 : {mapped}건")
        print(f"   - 매칭 실패한 tool_name : {len(missing_tools)}개")
        for name in missing_tools:
            print(f"       • {name}")
        if missing_tags:
            print(f"   - 매핑 실패한 (도구, 태그) : {len(missing_tags)}건")
            for tool_name, tag_name in missing_tags:
                print(f"       • {tool_name} → {tag_name}")
        print(f"   - 최종 tags 총 행수 : {tags_total}")
        print(f"   - 최종 tool_tags 총 행수 : {tool_tags_total}")
        print("\n✅ 모든 작업 완료(commit)!")

    except Exception as e:
        # 예외 시 전체 rollback(부분 적재 방지).
        conn.rollback()
        print(f"\n❌ 적재 실패, 롤백했습니다: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
