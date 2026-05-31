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
    search: str = Query(None, description="제목/내용/도구명 검색어"),
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
        SELECT n.id, n.tool_id, t.name, n.title, n.content, n.news_date, n.source_url, n.collected_date,
               n.title_ko, n.summary_ko
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

        # 검색어 필터링 (공백 trim 후 비어있지 않은 경우만 적용)
        # 검색어는 :search 바인딩으로만 전달하고 ILIKE 패턴의 % 는 파라미터 값에 포함한다.
        search_term = search.strip() if search else ""
        search_clause = (
            " AND (n.title ILIKE :search OR n.content ILIKE :search"
            " OR n.title_ko ILIKE :search OR t.name ILIKE :search)"
        )
        if search_term:
            query += search_clause
            params["search"] = f"%{search_term}%"
            count_params["search"] = f"%{search_term}%"

        # 정렬 및 페이징
        query += " ORDER BY n.news_date DESC"
        query += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset

        # 전체 개수 조회 (메인 쿼리와 동일한 조인·조건을 유지해 결과 수를 일치시킨다)
        count_query = """
        SELECT COUNT(*)
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - (:days * INTERVAL '1 day')
        """
        if tool_id:
            count_query += " AND n.tool_id = :tool_id"
        if search_term:
            count_query += search_clause

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
                "source_url": row[6],
                "collected_date": str(row[7]) if row[7] else None,
                # 한글 번역(번역 비활성/실패 시 None). 프론트는 있으면 한글, 없으면 원문 사용.
                "title_ko": row[8],
                "summary_ko": row[9]
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
        # 도구 단위 집계: 최근 N일간 업데이트(뉴스)가 많은 도구 순.
        # GROUP BY 는 도구 식별자(n.tool_id, t.name)로만 묶어 도구당 1행이 되도록 한다.
        # 대표 뉴스의 최신 일자는 MAX(n.news_date) 로 가져온다(집계 외 컬럼은 SELECT 하지 않음).
        query = """
        SELECT n.tool_id, t.name, COUNT(*) as update_count, MAX(n.news_date) as latest_news_date
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - (:days * INTERVAL '1 day')
        GROUP BY n.tool_id, t.name
        ORDER BY update_count DESC, latest_news_date DESC
        LIMIT :limit
        """

        result = db.execute(text(query), {"days": days, "limit": limit})
        news = [
            {
                "tool_id": row[0],
                "tool_name": row[1],
                "update_count": row[2],
                "latest_news_date": str(row[3]) if row[3] else None
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
