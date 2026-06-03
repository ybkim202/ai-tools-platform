"""LMArena 대화선호 Elo 자동수집기(Phase B) — 키 불필요.

arena-ai-leaderboards 공개 미러(GitHub, 일일 JSON 스냅샷)의 Text arena 리더보드를
가져와, 각 도구의 representative_model(=LMArena vendor 식별자)에 해당하는 **그 vendor의
최고 Elo 모델**을 그 도구의 'LMArena Elo'(category=선호, unit=elo) 점수로 갱신한다.

왜 vendor 매핑인가
------------------
LMArena 모델 식별자(gpt-5.5-high 등)는 매주 바뀌어 고정 매칭이 깨지기 쉽다. vendor
(OpenAI/Anthropic/Google)는 안정적이므로, "그 vendor의 현재 최강 모델 Elo"를 도구
대표로 쓴다. 실제 매칭된 모델 식별자는 model_version 에 기록(추적성).

키/토큰
-------
필요 없음(공개 GitHub raw). base.http_get 의 타임아웃/재시도를 그대로 쓴다.
미러가 비공식이므로(소스 불안정 가능) 실패 시 조용히 0 을 반환한다(에러 격리).

멱등성
------
도구당 'LMArena Elo' 1행만 유지한다. 매 실행 시 기존 행을 DELETE 후 최신값을 INSERT
한다(스냅샷 교체 — github_trending 패턴). collect(conn) -> int(갱신 행수).

오프라인 단위검증
-----------------
top_model_by_vendor(models) 는 모델 리스트만 받아 vendor→최고Elo 모델을 만드는 순수 함수.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from .base import http_get

logger = logging.getLogger(__name__)

_REPO_API = "https://api.github.com/repos/oolong-tea-2026/arena-ai-leaderboards/contents/data"
_RAW_BASE = "https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data"

_BENCH_TYPE = "LMArena Elo"
_CATEGORY = "선호"
_UNIT = "elo"


def _latest_date() -> Optional[str]:
    """미러 data/ 의 최신 날짜 디렉토리명(YYYY-MM-DD)을 반환한다. 실패 시 None."""
    resp = http_get(_REPO_API)
    if resp is None:
        return None
    try:
        items = resp.json()
    except Exception:
        return None
    dates = sorted(
        x.get("name", "") for x in items
        if isinstance(x, dict) and x.get("type") == "dir" and x.get("name")
    )
    return dates[-1] if dates else None


def top_model_by_vendor(models) -> Dict[str, Dict]:
    """모델 리스트에서 vendor → 최고 Elo 모델 dict 를 만든다(순수 함수).

    입력: [{"model":str,"vendor":str,"score":int,...}, ...]
    같은 vendor 의 여러 모델 중 score 가 가장 큰 것을 채택.
    반환: {vendor: {"model":str, "score":float}}
    """
    best: Dict[str, Dict] = {}
    if not isinstance(models, list):
        return best
    for m in models:
        if not isinstance(m, dict):
            continue
        vendor = (m.get("vendor") or "").strip()
        model = (m.get("model") or "").strip()
        score = m.get("score")
        if not vendor or not model or score is None:
            continue
        try:
            score = float(score)
        except (TypeError, ValueError):
            continue
        cur = best.get(vendor)
        if cur is None or score > cur["score"]:
            best[vendor] = {"model": model, "score": score}
    return best


def _fetch_text_arena() -> Optional[Dict]:
    """최신 Text arena 스냅샷을 (date, vendor_map) 으로 가져온다. 실패 시 None."""
    date = _latest_date()
    if not date:
        logger.warning("[benchmarks_lmarena] 최신 날짜 조회 실패 — skip")
        return None
    resp = http_get(f"{_RAW_BASE}/{date}/text.json")
    if resp is None:
        logger.warning("[benchmarks_lmarena] %s/text.json 조회 실패 — skip", date)
        return None
    try:
        payload = resp.json()
        models = payload.get("models", [])
    except Exception:
        logger.warning("[benchmarks_lmarena] text.json 파싱 실패 — skip")
        return None
    return {"date": date, "vendors": top_model_by_vendor(models)}


def collect(conn) -> int:
    """representative_model(vendor) 이 있는 도구의 LMArena Elo 를 갱신한다. 갱신 행수 반환.

    base.collect_all 의 collector 시그니처(collect(conn) -> int)를 따른다.
    모든 SQL 은 psycopg2 %s 바인딩만 사용한다(헌법 G7).
    """
    snap = _fetch_text_arena()
    if snap is None:
        return 0
    date, vendors = snap["date"], snap["vendors"]
    source = f"LMArena Text arena via arena-ai-leaderboards mirror (snapshot {date})"
    logger.info("[benchmarks_lmarena] 스냅샷 %s, vendor %d종", date, len(vendors))

    cursor = conn.cursor()
    updated = 0
    skipped = 0
    try:
        cursor.execute(
            "SELECT id, name, representative_model FROM tools "
            "WHERE representative_model IS NOT NULL AND representative_model <> ''"
        )
        rows = cursor.fetchall()
        for tool_id, name, vendor in rows:
            top = vendors.get(vendor)
            if top is None:
                # 그 vendor 가 현재 Text arena 상위 목록에 없음(예: 순위권 밖) — skip.
                skipped += 1
                continue
            cursor.execute("SAVEPOINT lm_sp")
            try:
                # 도구당 LMArena Elo 1행만: 기존 제거 후 최신 삽입(스냅샷 교체).
                cursor.execute(
                    "DELETE FROM benchmarks WHERE tool_id = %s AND benchmark_type = %s",
                    (tool_id, _BENCH_TYPE),
                )
                cursor.execute(
                    "INSERT INTO benchmarks "
                    "(tool_id, benchmark_type, score, source, category, "
                    " model_version, unit, collected_date) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())",
                    (tool_id, _BENCH_TYPE, top["score"], source, _CATEGORY,
                     top["model"], _UNIT),
                )
                cursor.execute("RELEASE SAVEPOINT lm_sp")
                updated += 1
            except Exception as e:
                cursor.execute("ROLLBACK TO SAVEPOINT lm_sp")
                logger.warning("[benchmarks_lmarena] %s 갱신 실패(skip): %s", name, e)
        conn.commit()
    except Exception:
        conn.rollback()
        logger.exception("[benchmarks_lmarena] 수집 실패, 롤백")
        raise
    finally:
        cursor.close()

    logger.info("[benchmarks_lmarena] LMArena Elo 갱신 %d / 매칭없음 %d", updated, skipped)
    return updated
