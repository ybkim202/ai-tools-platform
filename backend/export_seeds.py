"""라이브 DB → 레포 시드(JSON) 역추출 — bootstrap baseline 최신화.

운영 중 누적된 데이터(자동 발견 도구·갱신된 지표 등)는 레포 시드에 반영되지 않아,
DB가 날아가면 bootstrap.py 가 옛 baseline(예: 78개)만 복원하는 갭이 있었다. 이 스크립트는
현재 DB 를 읽어 세 시드 파일을 loader 호환 형태로 다시 써서 baseline 을 라이브와 맞춘다.

  - tools_data.json     ← tools + pricing (load_tools_fixed.py 가 읽는 형태)
  - tags_seed.json      ← tags + tool_tags (seed_tags.py 형태)
  - benchmarks_data.json← benchmarks (seed_benchmarks.py 형태)

주의: news / github_trending 은 시드가 아니라 수집(collectors)로 채워지므로 export 대상이
아니다(전체 보존은 pg_dump 백업 책임 — backup_db.py 참조).

실행:
    DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python export_seeds.py
보안(헌법 G9): 크리덴셜은 환경변수 DATABASE_URL 로만. 파일에 절대 쓰지 않는다.
"""

import json
import os
import sys
from decimal import Decimal

import psycopg2

HERE = os.path.dirname(os.path.abspath(__file__))


def _num(v):
    """numeric/Decimal → JSON 친화 숫자(정수면 int, 아니면 float). None 은 그대로."""
    if v is None:
        return None
    if isinstance(v, Decimal):
        v = float(v)
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def export_tools(cur):
    cur.execute(
        """
        SELECT id, name, logo_url, official_url, description, category, country,
               difficulty, user_count, user_count_source, github_repo,
               representative_model
        FROM tools ORDER BY id
        """
    )
    rows = cur.fetchall()
    tools = []
    for (tid, name, logo_url, official_url, description, category, country,
         difficulty, user_count, user_count_source, github_repo,
         representative_model) in rows:
        cur.execute(
            """
            SELECT plan_name, price, currency, billing_period, description
            FROM pricing WHERE tool_id = %s ORDER BY id
            """,
            (tid,),
        )
        pricing = []
        for plan_name, price, currency, billing_period, p_desc in cur.fetchall():
            item = {
                "plan_name": plan_name,
                "price": _num(price),
                "billing_period": billing_period,
                "description": p_desc or "",
            }
            if currency is not None:
                item["currency"] = currency
            pricing.append(item)

        tool = {
            "name": name,
            "logo_url": logo_url,
            "official_url": official_url,
            "description": description,
            "category": category,
            "country": country,
            "difficulty": difficulty,
            "user_count": _num(user_count),
            "user_count_source": user_count_source,
        }
        # 선택 필드는 값이 있을 때만(자동 발견 도구는 비어 있을 수 있음).
        if representative_model is not None:
            tool["representative_model"] = representative_model
        if github_repo is not None:
            tool["github_repo"] = github_repo
        tool["pricing"] = pricing
        tools.append(tool)
    return tools


def export_tags(cur):
    cur.execute("SELECT name, type FROM tags ORDER BY id")
    tags = [{"name": n, "type": t} for n, t in cur.fetchall()]
    cur.execute(
        """
        SELECT t.name, array_agg(tg.name ORDER BY tg.id)
        FROM tools t
        JOIN tool_tags tt ON tt.tool_id = t.id
        JOIN tags tg ON tg.id = tt.tag_id
        GROUP BY t.id, t.name
        ORDER BY t.id
        """
    )
    tool_tags = [{"tool_name": name, "tags": tag_names} for name, tag_names in cur.fetchall()]
    return {"tags": tags, "tool_tags": tool_tags}


def export_benchmarks(cur):
    cur.execute(
        """
        SELECT t.id, t.name, b.benchmark_type, b.category, b.model_version,
               b.score, b.source, b.unit
        FROM benchmarks b JOIN tools t ON t.id = b.tool_id
        ORDER BY t.id, b.id
        """
    )
    by_tool = {}
    order = []
    for tid, name, btype, category, model_version, score, source, unit in cur.fetchall():
        if tid not in by_tool:
            by_tool[tid] = {"tool_name": name, "benchmarks": []}
            order.append(tid)
        by_tool[tid]["benchmarks"].append(
            {
                "benchmark_type": btype,
                "category": category,
                "model_version": model_version,
                "score": _num(score),
                "source": source,
                "unit": unit,
            }
        )
    return [by_tool[t] for t in order]


def _write(rel_path, data):
    path = os.path.join(HERE, rel_path)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return path


def main():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit(
            "❌ DATABASE_URL 이 필요합니다.\n"
            "   예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python export_seeds.py"
        )
    conn = psycopg2.connect(url)
    try:
        cur = conn.cursor()
        tools = export_tools(cur)
        tags = export_tags(cur)
        benches = export_benchmarks(cur)
    finally:
        conn.close()

    _write("tools_data.json", tools)
    _write("tags_seed.json", tags)
    _write("benchmarks_data.json", benches)

    print("✅ 시드 export 완료(라이브 → 레포):")
    print(f"   tools_data.json      : {len(tools)} 도구")
    print(f"   tags_seed.json       : tags {len(tags['tags'])} · tool_tags {len(tags['tool_tags'])}")
    print(f"   benchmarks_data.json : {len(benches)} 도구")


if __name__ == "__main__":
    main()
