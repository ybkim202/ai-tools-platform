from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db

router = APIRouter(prefix="/api/tools", tags=["tools"])

# ==================== Tools 엔드포인트 ====================
@router.get("")
def get_tools(
    category: str = Query(None, description="카테고리"),
    country: str = Query(None, description="국가"),
    difficulty: str = Query(None, description="난이도"),
    min_price: float = Query(None, description="최소 가격"),
    max_price: float = Query(None, description="최대 가격"),
    min_users: int = Query(None, description="최소 사용자 수"),
    max_users: int = Query(None, description="최대 사용자 수"),
    sort_by: str = Query("popularity", description="정렬 기준"),
    limit: int = Query(20, ge=1, le=100, description="페이지당 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    search: str = Query(None, description="검색어"),
    db: Session = Depends(get_db)
):
    """도구 목록 조회 (필터링, 정렬, 페이징 지원)"""
    try:
        # 쿼리 빌드
        query = "SELECT * FROM tools WHERE 1=1"
        params = {}
        
        # 필터링
        if search:
            query += " AND name ILIKE %(search)s"
            params["search"] = f"%{search}%"
        
        if category:
            query += " AND category = %(category)s"
            params["category"] = category
        
        if country:
            query += " AND country = %(country)s"
            params["country"] = country
        
        if difficulty:
            query += " AND difficulty = %(difficulty)s"
            params["difficulty"] = difficulty
        
        if min_price is not None:
            query += " AND (SELECT MIN(price) FROM pricing WHERE tool_id = tools.id) >= %(min_price)s"
            params["min_price"] = min_price
        
        if max_price is not None:
            query += " AND (SELECT MAX(price) FROM pricing WHERE tool_id = tools.id) <= %(max_price)s"
            params["max_price"] = max_price
        
        if min_users is not None:
            query += " AND user_count >= %(min_users)s"
            params["min_users"] = min_users
        
        if max_users is not None:
            query += " AND user_count <= %(max_users)s"
            params["max_users"] = max_users
        
        # 정렬
        if sort_by == "price":
            query += " ORDER BY (SELECT AVG(price) FROM pricing WHERE tool_id = tools.id)"
        elif sort_by == "recent":
            query += " ORDER BY updated_at DESC"
        else:
            query += " ORDER BY user_count DESC"
        
        # 전체 개수 조회
        count_query = f"SELECT COUNT(*) FROM ({query}) as counted"
        total_result = db.execute(text(count_query), params)
        total = total_result.scalar()
        
        # 페이징 적용
        query += f" LIMIT {limit} OFFSET {offset}"
        
        # 도구 조회
        result = db.execute(text(query), params)
        tools = [
            {
                "id": row[0],
                "name": row[1],
                "logo_url": row[2],
                "official_url": row[3],
                "description": row[4],
                "category": row[5],
                "country": row[6],
                "difficulty": row[7],
                "user_count": row[8],
                "user_count_source": row[9],
                "user_count_date": str(row[10]) if row[10] else None,
                "created_at": str(row[11]),
                "updated_at": str(row[12])
            }
            for row in result.fetchall()
        ]
        
        return {
            "success": True,
            "data": tools,
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

# ==================== Tools 상세 조회 ====================
@router.get("/{tool_id}")
def get_tool_detail(tool_id: int, db: Session = Depends(get_db)):
    """특정 도구의 상세 정보 조회"""
    try:
        # 도구 정보 조회
        tool_query = "SELECT * FROM tools WHERE id = %(tool_id)s"
        tool_result = db.execute(text(tool_query), {"tool_id": tool_id})
        tool_row = tool_result.fetchone()
        
        if not tool_row:
            return {
                "success": False,
                "error": {
                    "code": "TOOL_NOT_FOUND",
                    "message": "요청한 도구를 찾을 수 없습니다."
                }
            }
        
        tool = {
            "id": tool_row[0],
            "name": tool_row[1],
            "logo_url": tool_row[2],
            "official_url": tool_row[3],
            "description": tool_row[4],
            "category": tool_row[5],
            "country": tool_row[6],
            "difficulty": tool_row[7],
            "user_count": tool_row[8],
            "user_count_source": tool_row[9],
            "user_count_date": str(tool_row[10]) if tool_row[10] else None,
        }
        
        # 벤치마크 조회
        benchmark_query = "SELECT id, benchmark_type, score, source, collected_date FROM benchmarks WHERE tool_id = %(tool_id)s"
        benchmark_result = db.execute(text(benchmark_query), {"tool_id": tool_id})
        benchmarks = [
            {
                "id": row[0],
                "benchmark_type": row[1],
                "score": float(row[2]),
                "source": row[3],
                "collected_date": str(row[4]) if row[4] else None
            }
            for row in benchmark_result.fetchall()
        ]
        
        # 가격 조회
        pricing_query = "SELECT id, plan_name, price, currency, billing_period, description FROM pricing WHERE tool_id = %(tool_id)s"
        pricing_result = db.execute(text(pricing_query), {"tool_id": tool_id})
        pricing = [
            {
                "id": row[0],
                "plan_name": row[1],
                "price": float(row[2]) if row[2] else 0,
                "currency": row[3],
                "billing_period": row[4],
                "description": row[5]
            }
            for row in pricing_result.fetchall()
        ]
        
        # 뉴스 조회
        news_query = "SELECT id, title, content, news_date, source_url FROM news WHERE tool_id = %(tool_id)s ORDER BY news_date DESC LIMIT 5"
        news_result = db.execute(text(news_query), {"tool_id": tool_id})
        news = [
            {
                "id": row[0],
                "title": row[1],
                "content": row[2],
                "news_date": str(row[3]) if row[3] else None,
                "source_url": row[4]
            }
            for row in news_result.fetchall()
        ]
        
        return {
            "success": True,
            "data": {
                **tool,
                "benchmarks": benchmarks,
                "pricing": pricing,
                "recent_news": news
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
