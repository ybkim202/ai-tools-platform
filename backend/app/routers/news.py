import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])

# ==================== 뉴스 조회 ====================
@router.get("")
def get_news(
    tool_id: int = Query(None, description="특정 도구의 뉴스만 조회"),
    days: int = Query(30, ge=1, le=365, description="최근 N일 이내"),
    limit: int = Query(20, ge=1, le=100, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    db: Session = Depends(get_db)
):
    """
    최신 뉴스와 업데이트 조회
    """
    try:
        # 쿼리 빌드 (INTERVAL 은 :days 정수 바인딩으로 계산)
        query = """
        SELECT n.id, n.tool_id, t.name, n.title, n.content, n.news_date, n.source_url
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - (:days * INTERVAL '1 day')
        """
        params = {"days": days}

        # 전체 개수 조회용 파라미터 (페이징 파라미터 제외)
        count_params = {"days": days}

        # 특정 도구 필터링
        if tool_id:
            query += " AND n.tool_id = :tool_id"
            params["tool_id"] = tool_id
            count_params["tool_id"] = tool_id

        # 정렬 및 페이징
        query += " ORDER BY n.news_date DESC"
        query += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset

        # 전체 개수 조회
        count_query = """
        SELECT COUNT(*)
        FROM news n
        WHERE n.collected_date >= NOW() - (:days * INTERVAL '1 day')
        """
        if tool_id:
            count_query += " AND n.tool_id = :tool_id"

        total_result = db.execute(text(count_query), count_params)
        total = total_result.scalar()

        # 뉴스 조회
        result = db.execute(text(query), params)
        news = [
            {
                "id": row[0],
                "tool_id": row[1],
                "tool_name": row[2],
                "title": row[3],
                "content": row[4],
                "news_date": str(row[5]) if row[5] else None,
                "source_url": row[6]
            }
            for row in result.fetchall()
        ]
        
        return {
            "success": True,
            "data": news,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception:
        logger.exception("뉴스 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }

# ==================== 최근 뉴스 (모든 도구) ====================
@router.get("/trending")
def get_trending_news(
    days: int = Query(7, ge=1, le=30, description="최근 N일 이내"),
    limit: int = Query(10, ge=1, le=50, description="최대 결과 수"),
    db: Session = Depends(get_db)
):
    """
    최근 가장 업데이트가 많은 도구들의 뉴스 조회 (트렌딩)
    """
    try:
        query = """
        SELECT n.id, n.tool_id, t.name, n.title, n.content, n.news_date, COUNT(*) as update_count
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - (:days * INTERVAL '1 day')
        GROUP BY n.tool_id, t.name, n.id
        ORDER BY update_count DESC, n.news_date DESC
        LIMIT :limit
        """

        result = db.execute(text(query), {"days": days, "limit": limit})
        news = [
            {
                "id": row[0],
                "tool_id": row[1],
                "tool_name": row[2],
                "title": row[3],
                "content": row[4],
                "news_date": str(row[5]) if row[5] else None,
                "update_count": row[6]
            }
            for row in result.fetchall()
        ]
        
        return {
            "success": True,
            "data": news,
            "period_days": days
        }
    
    except Exception:
        logger.exception("뉴스 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }
