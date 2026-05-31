import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..exceptions import AIToolsException, ToolNotFound, InvalidParameters

logger = logging.getLogger(__name__)

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
        # ID 파싱 (잘못된 파라미터는 HTTP 400 으로 통일)
        try:
            tool_ids = [int(id.strip()) for id in ids.split(',')]
        except ValueError:
            raise InvalidParameters("ID는 숫자여야 하며 쉼표로 구분해야 합니다.")

        # 비교는 의미상 최소 2개 이상이어야 한다(문서 계약: 2~5개).
        if len(tool_ids) < 2 or len(tool_ids) > 5:
            raise InvalidParameters("비교는 2~5개의 도구를 지정해야 합니다.")
        
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
            # HTTP 404 로 통일 (예외 핸들러가 표준 본문으로 변환)
            raise ToolNotFound("요청한 도구를 찾을 수 없습니다.")

        return {
            "success": True,
            "data": {
                "comparison": comparison,
                "total_tools": len(comparison),
            },
            "error": None,
        }

    except AIToolsException:
        # 커스텀 예외(ToolNotFound→404, InvalidParameters→400)는
        # 표준 예외 핸들러로 전달되도록 그대로 재발생한다.
        raise
    except Exception:
        logger.exception("도구 비교 중 오류 발생")
        return {
            "success": False,
            "data": None,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }
