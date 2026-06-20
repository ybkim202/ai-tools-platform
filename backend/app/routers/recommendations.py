import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session
from ..database import get_db
from ..exceptions import db_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

# ==================== 맞춤 추천 ====================
@router.get("")
def get_recommendations(
    task: str = Query(None, description="업무 (콘텐츠작성, 이미지생성 등)"),
    profession: str = Query(None, description="직업 (개발자, 디자이너 등)"),
    limit: int = Query(10, ge=1, le=50, description="추천 개수"),
    db: Session = Depends(get_db)
):
    """
    맞춤 추천 - 업무 또는 직업에 따른 도구 추천

    응답 meta.feature_status:
        - "coming_soon": 추천 산출에 필요한 태그/매핑 데이터(tags·tool_tags)가
          DB에 없음. 프론트는 "준비 중" 안내를 표시한다.
        - "ready": 태그 데이터는 존재하며 정상 동작. 결과가 0건이면 단순 빈 결과.
        task/profession 없이 인기 도구를 반환하는 경로는 태그에 의존하지 않으므로
        항상 "ready" 다.
    """
    try:
        def _has_tag_data() -> bool:
            """추천 산출에 필요한 태그/매핑 데이터가 DB에 적재되어 있는지 확인."""
            tags_count = db.execute(
                text("SELECT COUNT(*) FROM tags")
            ).scalar()
            mapping_count = db.execute(
                text("SELECT COUNT(*) FROM tool_tags")
            ).scalar()
            return bool(tags_count) and bool(mapping_count)

        def _matched_tags_by_tool(tool_ids: list, tag_type: str) -> dict:
            """주어진 도구들에 대해 지정한 type 의 태그 이름 목록을 도구 id별로 매핑.

            N+1 을 피하기 위해 tool_id IN (...) 으로 한 번에 조회한다.

            Args:
                tool_ids: 태그를 조회할 도구 id 목록.
                tag_type: 'task' | 'profession'. 매칭 근거로 노출할 태그 종류.

            Returns:
                {tool_id: [tag_name, ...]} 형태의 딕셔너리. 비면 빈 dict.
            """
            if not tool_ids:
                return {}
            tag_query = """
            SELECT tt.tool_id, tg.name
            FROM tool_tags tt
            INNER JOIN tags tg ON tt.tag_id = tg.id
            WHERE tt.tool_id IN :tool_ids AND tg.type = :tag_type
            ORDER BY tg.name
            """
            tag_result = db.execute(
                text(tag_query).bindparams(
                    bindparam("tool_ids", expanding=True)
                ),
                {"tool_ids": tool_ids, "tag_type": tag_type},
            )
            mapping: dict = {}
            for tool_id_val, tag_name in tag_result.fetchall():
                mapping.setdefault(tool_id_val, []).append(tag_name)
            return mapping

        # 태그 기반 추천(task/profession)은 태그 데이터 적재 여부에 따라 상태가 갈린다.
        # 인기 도구 폴백 경로는 태그에 의존하지 않으므로 항상 "ready".
        if task or profession:
            feature_status = "ready" if _has_tag_data() else "coming_soon"
        else:
            feature_status = "ready"

        # 업무별 추천
        if task:
            query = """
            SELECT DISTINCT t.id, t.name, t.category, t.user_count, t.difficulty
            FROM tools t
            INNER JOIN tool_tags tt ON t.id = tt.tool_id
            INNER JOIN tags tg ON tt.tag_id = tg.id
            WHERE tg.name = :task AND tg.type = 'task'
            ORDER BY t.user_count DESC
            LIMIT :limit
            """
            result = db.execute(text(query), {"task": task, "limit": limit})
            rows = result.fetchall()
            # 매칭 근거: 각 도구가 가진 task 타입 태그 이름들(요청 task 포함).
            tag_map = _matched_tags_by_tool([row[0] for row in rows], "task")
            tools = [
                {
                    "id": row[0],
                    "name": row[1],
                    "category": row[2],
                    "user_count": row[3],
                    "difficulty": row[4],
                    "reason": f"'{task}' 작업에 최적화된 도구입니다.",
                    "matched_tags": tag_map.get(row[0], [])
                }
                for row in rows
            ]
        
        # 직업별 추천
        elif profession:
            query = """
            SELECT DISTINCT t.id, t.name, t.category, t.user_count, t.difficulty
            FROM tools t
            INNER JOIN tool_tags tt ON t.id = tt.tool_id
            INNER JOIN tags tg ON tt.tag_id = tg.id
            WHERE tg.name = :profession AND tg.type = 'profession'
            ORDER BY t.user_count DESC
            LIMIT :limit
            """
            result = db.execute(text(query), {"profession": profession, "limit": limit})
            rows = result.fetchall()
            # 매칭 근거: 각 도구가 가진 profession 타입 태그 이름들(요청 profession 포함).
            tag_map = _matched_tags_by_tool([row[0] for row in rows], "profession")
            tools = [
                {
                    "id": row[0],
                    "name": row[1],
                    "category": row[2],
                    "user_count": row[3],
                    "difficulty": row[4],
                    "reason": f"{profession}들이 많이 사용하는 도구입니다.",
                    "matched_tags": tag_map.get(row[0], [])
                }
                for row in rows
            ]
        
        # 둘 다 없으면 인기 도구 반환
        else:
            query = """
            SELECT id, name, category, user_count, difficulty
            FROM tools
            ORDER BY user_count DESC
            LIMIT :limit
            """
            result = db.execute(text(query), {"limit": limit})
            tools = [
                {
                    "id": row[0],
                    "name": row[1],
                    "category": row[2],
                    "user_count": row[3],
                    "difficulty": row[4],
                    "reason": "현재 가장 인기 있는 도구입니다."
                }
                for row in result.fetchall()
            ]
        
        # 태그 데이터 미적재 시에는 결과를 비워 "준비 중" 의미를 명확히 한다.
        if feature_status == "coming_soon":
            tools = []

        return {
            "success": True,
            "data": tools,
            "meta": {
                "feature_status": feature_status,
                "query": {
                    "task": task,
                    "profession": profession
                }
            },
            "error": None,
        }

    except Exception:
        return db_error(logger, "추천 조회 중 오류 발생")
