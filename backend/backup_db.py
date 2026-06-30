"""DB 전체 백업 — pg_dump 커스텀 포맷(.dump) 한 방. 만료/사고 대비 안전망.

시드 export(export_seeds.py)는 tools/tags/benchmarks **baseline** 만 잡는다. news /
github_trending 등 수집 누적분까지 보존하려면 DB 전체 덤프가 필요하다. 이 스크립트는
현재 DB 를 backups/<UTC타임스탬프>.dump(pg_dump -Fc) 로 떨군다(backups/ 는 .gitignore).

복원:
    pg_restore --no-owner --no-privileges -d "$NEW_DATABASE_URL" backups/<파일>.dump

주의:
- pg_dump 클라이언트 버전 >= 서버 버전이어야 한다(Neon/Supabase 는 PG17+ → libpq 17+ 필요).
  macOS: `brew install libpq` 후 /opt/homebrew/opt/libpq/bin/pg_dump 사용.
- 보안(헌법 G9): 크리덴셜은 환경변수 DATABASE_URL 로만. 파일/커밋에 쓰지 않는다.

실행:
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python backup_db.py
    # 또는 pg_dump 경로 지정: PG_DUMP=/opt/homebrew/opt/libpq/bin/pg_dump python backup_db.py
"""

import os
import subprocess
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BACKUP_DIR = os.path.join(os.path.dirname(HERE), "backups")


def main():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit(
            "❌ DATABASE_URL 이 필요합니다.\n"
            "   예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python backup_db.py"
        )
    pg_dump = os.getenv("PG_DUMP", "pg_dump")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out = os.path.join(BACKUP_DIR, f"{stamp}.dump")

    cmd = [pg_dump, "--format=custom", "--no-owner", "--no-privileges", "--file", out, url]
    print(f"🗄️  pg_dump → {out}")
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        raise SystemExit(
            f"❌ '{pg_dump}' 실행 불가. libpq 설치 후 PG_DUMP 로 경로를 지정하세요 "
            "(brew install libpq → /opt/homebrew/opt/libpq/bin/pg_dump)."
        )
    except subprocess.CalledProcessError as e:
        raise SystemExit(f"❌ pg_dump 실패(exit {e.returncode}). 클라이언트 버전(>= 서버) 확인.")

    size = os.path.getsize(out)
    print(f"✅ 백업 완료: {out} ({size:,} bytes)")


if __name__ == "__main__":
    main()
