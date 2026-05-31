"""공개 벤치마크 점수(benchmarks) 시드 적재 스크립트.

목적
----
benchmarks 라우터(`backend/app/routers/benchmarks.py`)가 조회하는
`benchmarks(id, tool_id, benchmark_type, score, source, collected_date)` 테이블에
검증 가능한 공개 표준 벤치마크 점수(`benchmarks_data.json`)를 적재한다.

데이터 정합성(헌법)
-------------------
모든 점수는 공신력 있는 공개 출처(공식 모델카드/기술보고서/표준 리더보드)를
`source` 에 명시한다. 표준 벤치가 없는 도구(이미지/음성/디자인 등)는 시드에
포함하지 않는다(억지 점수 금지).

멱등성(재실행 안전)
-------------------
benchmarks 테이블에는 유니크 제약이 없으므로, 코드에서 적재 전
(tool_id, benchmark_type, source) 조합 존재 여부를 SELECT 로 확인하고
이미 있으면 skip 한다. 따라서 재실행 시 중복 행이 생기지 않고
"신규 0 / 스킵 N" 으로 수렴한다. collected_date 는 적재 시각(NOW())으로 채운다.

보안(헌법 G9)
-------------
크리덴셜은 절대 하드코딩하지 않는다. 접속정보는 환경변수 `DATABASE_URL` 로만
주입한다. 미설정 시 즉시 종료한다. 모든 SQL 은 %s 파라미터 바인딩(f-string 금지).

실행 방법
---------
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python seed_benchmarks.py

실행 순서(중요)
---------------
1) `python load_tools_fixed.py`  → tools 테이블 적재 (benchmarks 가 참조함)
2) `python seed_benchmarks.py`   → benchmarks 적재
tools 가 먼저 적재돼 있지 않으면 매칭 실패한 tool_name 이 스킵된다.
"""

import json
import os
from numbers import Real

import psycopg2

# 접속정보는 환경변수로만 주입한다(seed_tags.py 와 동일 패턴).
# NEVER: 접속 문자열(비밀번호 포함)을 소스에 하드코딩하지 않는다(헌법 G9).
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise SystemExit(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python seed_benchmarks.py"
    )

SEED_FILE = "benchmarks_data.json"

# 합리 범위 가드. 표준 LLM 벤치(MMLU/HumanEval/GPQA/MATH/MMMU/GSM8K 등)는
# 모두 0~100(% 또는 정확도 척도)이라 보수적으로 이 범위를 강제한다.
SCORE_MIN = 0.0
SCORE_MAX = 100.0


def load_seed(filename: str = SEED_FILE) -> list:
    """benchmarks_data.json 을 읽어 구조/타입/범위를 검증한 뒤 리스트로 반환한다.

    Args:
        filename: 시드 JSON 파일 경로.

    Returns:
        [{"tool_name": str, "benchmarks": [{benchmark_type, score, source}, ...]}, ...]

    Raises:
        SystemExit: 파일이 없거나 JSON 형식/구조/타입/범위가 잘못된 경우.
    """
    try:
        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit(f"❌ 시드 파일을 찾을 수 없습니다: {filename}")
    except json.JSONDecodeError as e:
        raise SystemExit(f"❌ 시드 JSON 형식이 잘못되었습니다: {e}")

    # 구조 검증: 최상위는 배열.
    if not isinstance(data, list):
        raise SystemExit("❌ 시드 최상위는 배열이어야 합니다.")

    total_rows = 0
    for i, entry in enumerate(data):
        if not isinstance(entry, dict):
            raise SystemExit(f"❌ [{i}] 항목은 객체여야 합니다.")
        tool_name = entry.get("tool_name")
        benchmarks = entry.get("benchmarks")
        if not isinstance(tool_name, str) or not tool_name.strip():
            raise SystemExit(f"❌ [{i}] tool_name 은 비어있지 않은 문자열이어야 합니다.")
        if not isinstance(benchmarks, list) or not benchmarks:
            raise SystemExit(
                f"❌ [{i}] '{tool_name}' benchmarks 는 비어있지 않은 배열이어야 합니다."
            )

        for j, b in enumerate(benchmarks):
            if not isinstance(b, dict):
                raise SystemExit(f"❌ [{i}].benchmarks[{j}] 는 객체여야 합니다.")
            btype = b.get("benchmark_type")
            score = b.get("score")
            source = b.get("source")
            if not isinstance(btype, str) or not btype.strip():
                raise SystemExit(
                    f"❌ '{tool_name}' benchmarks[{j}] benchmark_type 누락/형식 오류."
                )
            # bool 은 int 의 서브클래스라 명시적으로 배제한다.
            if isinstance(score, bool) or not isinstance(score, Real):
                raise SystemExit(
                    f"❌ '{tool_name}'/{btype} score 는 숫자여야 합니다: {score!r}"
                )
            if not (SCORE_MIN <= float(score) <= SCORE_MAX):
                raise SystemExit(
                    f"❌ '{tool_name}'/{btype} score 가 합리 범위(0~100) 밖입니다: {score}"
                )
            if not isinstance(source, str) or not source.strip():
                raise SystemExit(
                    f"❌ '{tool_name}'/{btype} source(출처) 가 필요합니다(공개 출처 표기)."
                )
            total_rows += 1

    print(
        f"✅ 시드 로드/검증 완료: 도구 {len(data)}개, 벤치 행 {total_rows}개"
    )
    return data


def _exists(cursor, tool_id: int, benchmark_type: str, source: str) -> bool:
    """동일 (tool_id, benchmark_type, source) 행이 이미 존재하는지 확인한다(멱등성 근거)."""
    cursor.execute(
        "SELECT 1 FROM benchmarks "
        "WHERE tool_id = %s AND benchmark_type = %s AND source = %s "
        "LIMIT 1",
        (tool_id, benchmark_type, source),
    )
    return cursor.fetchone() is not None


def seed_benchmarks(cursor, data: list) -> tuple:
    """benchmarks 를 멱등 적재한다.

    각 tool_name 을 tools 에서 조회(없으면 경고 후 skip),
    각 벤치는 (tool_id, benchmark_type, source) 중복이 아니면 INSERT,
    이미 있으면 skip 한다. collected_date 는 NOW() 로 채운다.

    Returns:
        (inserted, skipped, missing_tools)
        - inserted: 신규 삽입된 행 수
        - skipped: 이미 존재해 건너뛴 행 수
        - missing_tools: tools 에서 못 찾은 tool_name 목록
    """
    inserted = 0
    skipped = 0
    missing_tools = []

    for entry in data:
        tool_name = entry["tool_name"]
        cursor.execute("SELECT id FROM tools WHERE name = %s", (tool_name,))
        row = cursor.fetchone()
        if row is None:
            missing_tools.append(tool_name)
            print(f"⚠️  tools 에 없는 도구라 skip: {tool_name}")
            continue
        tool_id = row[0]

        for b in entry["benchmarks"]:
            btype = b["benchmark_type"]
            source = b["source"]
            score = b["score"]
            if _exists(cursor, tool_id, btype, source):
                skipped += 1
                continue
            cursor.execute(
                "INSERT INTO benchmarks "
                "(tool_id, benchmark_type, score, source, collected_date) "
                "VALUES (%s, %s, %s, %s, NOW())",
                (tool_id, btype, score, source),
            )
            inserted += cursor.rowcount

    print(f"✅ benchmarks 삽입: 신규 {inserted}개 / 스킵(이미존재) {skipped}개")
    return inserted, skipped, missing_tools


def verify(cursor) -> int:
    """최종 benchmarks 총 행수를 검증 조회한다."""
    cursor.execute("SELECT COUNT(*) FROM benchmarks")
    return cursor.fetchone()[0]


def main() -> None:
    """메인 실행: 시드 로드/검증 → DB 연결 → 적재 → 검증 → commit/rollback."""
    print("=" * 60)
    print("📊 공개 벤치마크 점수 시드 적재 스크립트")
    print("=" * 60)

    # 1) 시드 로드 + 구조/타입/범위 검증(DB 연결 전).
    print("\n[1단계] 시드 로드/검증")
    data = load_seed(SEED_FILE)

    # 2) DB 연결.
    print("\n[2단계] 데이터베이스 연결")
    conn = psycopg2.connect(DATABASE_URL)
    print("✅ PostgreSQL 연결 성공")

    cursor = conn.cursor()
    try:
        # 3) benchmarks 적재(멱등).
        print("\n[3단계] benchmarks 적재")
        inserted, skipped, missing_tools = seed_benchmarks(cursor, data)

        # 4) 검증.
        print("\n[4단계] 검증")
        total = verify(cursor)

        # 전체 성공 시에만 commit(멱등 트랜잭션).
        conn.commit()

        # 5) 요약 출력.
        print("\n" + "=" * 60)
        print("📊 적재 요약")
        print("=" * 60)
        print(f"   - benchmarks 신규/스킵 : {inserted} / {skipped}")
        print(f"   - 매칭 실패한 tool_name : {len(missing_tools)}개")
        for name in missing_tools:
            print(f"       • {name}")
        print(f"   - 최종 benchmarks 총 행수 : {total}")
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
