"""DB 부트스트랩 단일 진입점 — 스키마 → 도구/가격 → 태그를 한 번에 적재한다.

빈 새 PostgreSQL DB 를 레포만으로 완전히 세운다. 아래 세 단계를 순서대로 실행한다.
    1) init_db.main()          → 6개 테이블/인덱스 (schema.sql)
    2) load_tools_fixed.main() → tools / pricing (tools_data.json, 78개)
    3) seed_tags.main()        → tags / tool_tags (tags_seed.json)
세 스크립트 모두 멱등이라(IF NOT EXISTS / ON CONFLICT / name UNIQUE) 재실행해도 안전하다.

전제(load_tools_fixed 의 알려진 한계)
-------------------------------------
load_tools_fixed.py 는 도구가 이미 존재하면 UPDATE 만 하고 pricing 은 신규 INSERT
분기에서만 넣는다. 따라서 "빈 새 DB 1회 실행"을 전제로 한다(부분 적재 후 재실행 시
pricing 이 비어 있을 수 있음).

보안(헌법 G9)
-------------
크리덴셜은 환경변수 DATABASE_URL 로만 주입한다. 미설정 시 즉시 종료한다.

실행 방법
---------
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python bootstrap.py
"""

import os
import sys

# 1) DATABASE_URL 선검사 — 하위 모듈을 import 하면 모듈 로드 시점에 SystemExit 가
#    발생하므로, 그 전에 친절한 안내를 먼저 내보낸다.
if not os.getenv("DATABASE_URL", "").strip():
    raise SystemExit(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python bootstrap.py"
    )

# 2) cwd 를 backend 디렉토리로 고정한다.
#    load_tools_fixed.py(tools_data.json) · seed_tags.py(tags_seed.json) 가
#    상대경로로 파일을 열기 때문에, 어느 위치에서 실행해도 동작하도록 한다.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BACKEND_DIR)


def _run_step(label: str, func) -> None:
    """한 단계를 실행하고 실패하면 명확히 보고 후 중단한다."""
    print("\n" + "#" * 60)
    print(f"# {label}")
    print("#" * 60)
    try:
        func()
    except SystemExit:
        # 하위 스크립트가 명시적으로 종료를 요청한 경우 그대로 전파.
        raise
    except Exception as e:
        raise SystemExit(f"\n❌ '{label}' 단계에서 실패했습니다: {e}")


def main() -> None:
    """스키마 → 도구/가격 → 태그 → 벤치마크를 순서대로 적재한다."""
    # cwd 고정 후 import(모듈 로드 시 DATABASE_URL 검사가 통과하도록 위 선검사 선행).
    import init_db
    import load_tools_fixed
    import seed_tags
    import seed_benchmarks

    print("=" * 60)
    print("🚀 AITools DB 부트스트랩 시작")
    print("=" * 60)

    _run_step("1/4 스키마 초기화 (init_db)", init_db.main)
    _run_step("2/4 도구 · 가격 적재 (load_tools_fixed)", load_tools_fixed.main)
    _run_step("3/4 추천 태그 적재 (seed_tags)", seed_tags.main)
    # 벤치마크는 tools 적재 이후여야 FK 매칭 성공.
    _run_step("4/4 벤치마크 적재 (seed_benchmarks)", seed_benchmarks.main)

    print("\n" + "=" * 60)
    print("✅ 부트스트랩 완료! 탐색 · 비교 · 추천 · 벤치마크가 동작할 준비가 됐습니다.")
    print("   검증: backend/README.md 의 '검증' 절을 참고하세요.")
    print("=" * 60)


if __name__ == "__main__":
    sys.exit(main())
