from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/compare", tags=["compare"])

# ==================== 도구 비교 ====================
@router.get("")
def compare_tools(
    ids: str = Query(..., description="비교할 도구 ID들 (쉼표로 구분, 예: 1,2,3)"),
    db: Session = Depends(get_db)
):
    """
    여러 도구를 비교합니다
    """
    try:
        # ID 파싱
        try:
            tool_ids = [int(id.strip()) for id in ids.split(',')]
        except ValueError:
            return {
                "success": False,
                "error": {
                    "code": "INVALID_IDS",
                    "message": "ID는 숫자여야 하며 쉼표로 구분해야 합니다."
                }
            }
        
        if len(tool_ids) == 0 or len(tool_ids) > 5:
            return {
                "success": False,
                "error": {
                    "code": "INVALID_COUNT",
                    "message": "1개 이상 5개 이하의 도구를 비교할 수 있습니다."
                }
            }
        
        # 각 ID별로 도구 조회
        comparison = []
        
        for tool_id in tool_ids:
            # 도구 정보 조회
            tool_query = "SELECT id, name, category, user_count, difficulty, official_url FROM tools WHERE id = :tool_id"
            tool_result = db.execute(text(tool_query), {"tool_id": tool_id})
            tool_row = tool_result.fetchone()
            
            if not tool_row:
                continue
            
            # 가격 정보 조회
            pricing_query = "SELECT plan_name, price, currency, billing_period FROM pricing WHERE tool_id = :tool_id"
            pricing_result = db.execute(text(pricing_query), {"tool_id": tool_id})
            pricing = [
                {
                    "plan": row[0],
                    "price": float(row[1]) if row[1] else 0,
                    "currency": row[2],
                    "billing_period": row[3]
                }
                for row in pricing_result.fetchall()
            ]
            
            # 벤치마크 정보 조회
            benchmark_query = "SELECT benchmark_type, score FROM benchmarks WHERE tool_id = :tool_id"
            benchmark_result = db.execute(text(benchmark_query), {"tool_id": tool_id})
            benchmarks = {}
            for row in benchmark_result.fetchall():
                benchmarks[row[0]] = float(row[1])
            
            comparison.append({
                "id": tool_row[0],
                "name": tool_row[1],
                "category": tool_row[2],
                "user_count": tool_row[3],
                "difficulty": tool_row[4],
                "official_url": tool_row[5],
                "pricing": pricing,
                "benchmarks": benchmarks
            })
        
        if not comparison:
            return {
                "success": False,
                "error": {
                    "code": "TOOLS_NOT_FOUND",
                    "message": "요청한 도구를 찾을 수 없습니다."
                }
            }
        
        return {
            "success": True,
            "comparison": comparison,
            "total_tools": len(comparison)
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": str(e)
            }
        }
