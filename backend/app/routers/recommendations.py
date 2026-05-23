from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db

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
    """
    try:
        # 업무별 추천
        if task:
            query = f"""
            SELECT DISTINCT t.id, t.name, t.category, t.user_count, t.difficulty
            FROM tools t
            INNER JOIN tool_tags tt ON t.id = tt.tool_id
            INNER JOIN tags tg ON tt.tag_id = tg.id
            WHERE tg.name = %(task)s AND tg.type = 'task'
            ORDER BY t.user_count DESC
            LIMIT {limit}
            """
            result = db.execute(text(query), {"task": task})
            tools = [
                {
                    "id": row[0],
                    "name": row[1],
                    "category": row[2],
                    "user_count": row[3],
                    "difficulty": row[4],
                    "reason": f"'{task}' 작업에 최적화된 도구입니다."
                }
                for row in result.fetchall()
            ]
        
        # 직업별 추천
        elif profession:
            query = f"""
            SELECT DISTINCT t.id, t.name, t.category, t.user_count, t.difficulty
            FROM tools t
            INNER JOIN tool_tags tt ON t.id = tt.tool_id
            INNER JOIN tags tg ON tt.tag_id = tg.id
            WHERE tg.name = %(profession)s AND tg.type = 'profession'
            ORDER BY t.user_count DESC
            LIMIT {limit}
            """
            result = db.execute(text(query), {"profession": profession})
            tools = [
                {
                    "id": row[0],
                    "name": row[1],
                    "category": row[2],
                    "user_count": row[3],
                    "difficulty": row[4],
                    "reason": f"{profession}들이 많이 사용하는 도구입니다."
                }
                for row in result.fetchall()
            ]
        
        # 둘 다 없으면 인기 도구 반환
        else:
            query = f"""
            SELECT id, name, category, user_count, difficulty
            FROM tools
            ORDER BY user_count DESC
            LIMIT {limit}
            """
            result = db.execute(text(query))
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
        
        return {
            "success": True,
            "query": {
                "task": task,
                "profession": profession
            },
            "data": tools
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": str(e)
            }
        }
