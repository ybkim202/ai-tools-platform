from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db

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
        # 쿼리 빌드
        query = f"""
        SELECT n.id, n.tool_id, t.name, n.title, n.content, n.news_date, n.source_url
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - INTERVAL '{days} days'
        """
        params = {}
        
        # 특정 도구 필터링
        if tool_id:
            query += " AND n.tool_id = %(tool_id)s"
            params["tool_id"] = tool_id
        
        # 정렬 및 페이징
        query += " ORDER BY n.news_date DESC"
        query += f" LIMIT {limit} OFFSET {offset}"
        
        # 전체 개수 조회
        count_query = f"""
        SELECT COUNT(*)
        FROM news n
        WHERE n.collected_date >= NOW() - INTERVAL '{days} days'
        """
        if tool_id:
            count_query += " AND n.tool_id = %(tool_id)s"
        
        total_result = db.execute(text(count_query), params)
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
    
    except Exception as e:
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": str(e)
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
        query = f"""
        SELECT n.id, n.tool_id, t.name, n.title, n.content, n.news_date, COUNT(*) as update_count
        FROM news n
        INNER JOIN tools t ON n.tool_id = t.id
        WHERE n.collected_date >= NOW() - INTERVAL '{days} days'
        GROUP BY n.tool_id, t.name, n.id
        ORDER BY update_count DESC, n.news_date DESC
        LIMIT {limit}
        """
        
        result = db.execute(text(query))
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
    
    except Exception as e:
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": str(e)
            }
        }
