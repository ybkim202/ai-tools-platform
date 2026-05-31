"""깃헙 트렌드 라우터 — GET /api/trends/github.

데이터 소스는 github_trending 테이블(수집기 collectors/github_trending.py 가 period 별로
멱등 교체). 테마(주제 군집) 매핑은 파이썬(trends_themes.py)에서 수행한다 — 한 period 의
행수가 작으므로(~60행) 전체를 rank 순으로 조회한 뒤 메모리에서 집계·필터한다.

응답 계약(프론트 GithubTrends.jsx / services/api.js 정본 — 변경 불가)
--------------------------------------------------------------------
{
  "success": true,
  "data": {
    "repos": [{ id, owner, repo, name, avatar_url, html_url,
                description, description_ko, stars, language, topics: [...] }],
    "themes": [{ key, label, count }],   # 'all'(label='전체') 항상 포함, count 0 제외
    "total": <int>,                       # 현재 필터 기준 총 개수
    "collected_at": "<ISO>"               # 해당 period MAX(collected_date)
  },
  "pagination": { total, limit, offset, pages },
  "error": null
}

보안(헌법 G7)
-------------
모든 DB 접근은 SQLAlchemy text() 의 :name 바인딩만 사용한다(%(name)s / 문자열 포매팅 금지).
period 는 enum, theme 는 허용 키 화이트리스트, limit/offset 은 범위 검증을 거친다.
"""

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

# 테마 매핑 단일 정본. app 패키지 내부 모듈로 두어 패키지 상대 import 한다
# (database 와 동일 방식 — top-level import 는 gunicorn/uvicorn 기동 시 sys.path 미포함으로 실패).
from .. import trends_themes

from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/trends", tags=["trends"])

# 허용 period(enum). 미지정/비정상은 기본 weekly 로 정규화.
_VALID_PERIODS = ("weekly", "monthly")


def _normalize_period(period: Optional[str]) -> str:
    """period 를 허용 enum 으로 정규화한다(미지정/비정상 → 'weekly')."""
    if period and period in _VALID_PERIODS:
        return period
    return "weekly"


def _serialize_topics(raw) -> list:
    """topics 컬럼(JSONB)을 문자열 리스트로 안전 변환한다.

    드라이버에 따라 list 또는 JSON 문자열로 올 수 있어 둘 다 처리한다.
    """
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return [str(t) for t in parsed] if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


@router.get("/github")
def get_github_trending(
    period: str = Query("weekly", description="기간(weekly|monthly)"),
    theme: Optional[str] = Query(None, description="주제 군집 key(미지정/all=전체)"),
    limit: int = Query(12, ge=1, le=100, description="페이지당 레포 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    db: Session = Depends(get_db),
):
    """깃헙 트렌딩 레포를 기간·주제별로 조회한다(테마 매핑은 파이썬에서 집계).

    처리 순서:
      1) 해당 period 전체 행을 rank 순으로 조회(period 셋은 작음).
      2) 각 repo 에 테마 매핑 → themes[] 카운트 집계(period 전체 기준, 'all'=총합).
      3) theme 파라미터가 유효 키면 해당 테마 매칭 repo 만 필터.
      4) total=필터 후 개수, limit/offset 페이지네이션 후 repos[] 직렬화.
    """
    try:
        period = _normalize_period(period)

        # theme 입력 검증: 허용 키 화이트리스트. 'all'/미지정/비유효는 필터 없음으로 취급.
        theme_key = theme if (theme and trends_themes.is_valid_theme(theme)) else None
        if theme_key == trends_themes.ALL_THEME_KEY:
            theme_key = None

        # 해당 period 전체 행을 rank 순 조회(:period 바인딩).
        query = text(
            "SELECT id, owner, repo, name, avatar_url, html_url, description, "
            "       description_ko, stars, language, topics "
            "FROM github_trending "
            "WHERE period = :period "
            "ORDER BY rank ASC NULLS LAST, stars DESC"
        )
        rows = db.execute(query, {"period": period}).fetchall()

        # 신선도: 해당 period MAX(collected_date).
        collected_at_row = db.execute(
            text(
                "SELECT MAX(collected_date) FROM github_trending WHERE period = :period"
            ),
            {"period": period},
        ).scalar()
        collected_at = collected_at_row.isoformat() if collected_at_row else None

        # 각 repo 직렬화 + 테마 매핑(파이썬). themes 카운트 집계 동시 수행.
        all_repos = []
        theme_counts = {k: 0 for k in trends_themes.THEME_TOPICS}
        for row in rows:
            topics = _serialize_topics(row[10])
            matched = trends_themes.match_themes(topics)
            for mk in matched:
                theme_counts[mk] = theme_counts.get(mk, 0) + 1
            all_repos.append(
                {
                    "id": row[0],
                    "owner": row[1],
                    "repo": row[2],
                    "name": row[3],
                    "avatar_url": row[4],
                    "html_url": row[5],
                    "description": row[6],
                    "description_ko": row[7],
                    "stars": row[8],
                    "language": row[9],
                    "topics": topics,
                    "_themes": matched,  # 내부 필터용(직렬화 전 제거).
                }
            )

        # themes[]: 'all'(전체=총합) 항상 포함, count 0 큐레이션 테마는 제외.
        themes = [
            {
                "key": trends_themes.ALL_THEME_KEY,
                "label": trends_themes.ALL_THEME_LABEL,
                "count": len(all_repos),
            }
        ]
        for key in trends_themes.THEME_TOPICS:
            count = theme_counts.get(key, 0)
            if count > 0:
                themes.append(
                    {"key": key, "label": trends_themes.theme_label(key), "count": count}
                )

        # theme 필터 적용(유효 키일 때만).
        if theme_key:
            filtered = [r for r in all_repos if theme_key in r["_themes"]]
        else:
            filtered = all_repos

        total = len(filtered)

        # 페이지네이션 후 내부 키(_themes) 제거.
        page = filtered[offset : offset + limit]
        for r in page:
            r.pop("_themes", None)

        return {
            "success": True,
            "data": {
                "repos": page,
                "themes": themes,
                "total": total,
                "collected_at": collected_at,
            },
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "pages": (total + limit - 1) // limit if limit else 0,
            },
            "error": None,
        }

    except Exception:
        logger.exception("깃헙 트렌딩 조회 중 오류 발생")
        return {
            "success": False,
            "data": None,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다.",
            },
        }
