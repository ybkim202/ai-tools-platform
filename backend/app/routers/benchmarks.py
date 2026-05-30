import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])

# ==================== 벤치마크 조회 ====================
@router.get("")
def get_benchmarks(
    tool_id: int = Query(None, description="특정 도구의 벤치마크만 조회"),
    benchmark_type: str = Query(None, description="벤치마크 종류 (속도, 정확도, 비용효율, 사용성)"),
    sort_by: str = Query("score_desc", description="정렬 기준 (score_desc, score_asc, recent)"),
    limit: int = Query(20, ge=1, le=100, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    db: Session = Depends(get_db)
):
    """
    벤치마크 데이터 조회
    """
    try:
        # 쿼리 빌드
        query = """
        SELECT b.id, b.tool_id, t.name, b.benchmark_type, b.score, b.source, b.collected_date
        FROM benchmarks b
        INNER JOIN tools t ON b.tool_id = t.id
        WHERE 1=1
        """
        params = {}
        
        # 필터링
        if tool_id:
            query += " AND b.tool_id = :tool_id"
            params["tool_id"] = tool_id
        
        if benchmark_type:
            query += " AND b.benchmark_type = :benchmark_type"
            params["benchmark_type"] = benchmark_type
        
        # 정렬
        if sort_by == "score_asc":
            query += " ORDER BY b.score ASC"
        elif sort_by == "recent":
            query += " ORDER BY b.collected_date DESC"
        else:  # score_desc (기본값)
            query += " ORDER BY b.score DESC"
        
        # 전체 개수 조회
        count_query = """
        SELECT COUNT(*)
        FROM benchmarks b
        WHERE 1=1
        """
        if tool_id:
            count_query += " AND b.tool_id = :tool_id"
        if benchmark_type:
            count_query += " AND b.benchmark_type = :benchmark_type"
        
        total_result = db.execute(text(count_query), params)
        total = total_result.scalar()
        
        # 페이징 적용
        query += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset

        # 벤치마크 조회
        result = db.execute(text(query), params)
        benchmarks = [
            {
                "id": row[0],
                "tool_id": row[1],
                "tool_name": row[2],
                "benchmark_type": row[3],
                "score": float(row[4]),
                "source": row[5],
                "collected_date": str(row[6]) if row[6] else None
            }
            for row in result.fetchall()
        ]
        
        return {
            "success": True,
            "data": benchmarks,
            "pagination": {
                "total": total,
                "limit": limit,
                "offset": offset,
                "pages": (total + limit - 1) // limit
            }
        }
    
    except Exception:
        logger.exception("벤치마크 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }

# ==================== 도구별 벤치마크 요약 ====================
@router.get("/summary/{tool_id}")
def get_benchmark_summary(
    tool_id: int,
    db: Session = Depends(get_db)
):
    """
    특정 도구의 벤치마크 요약 (각 종류별 최신 점수)
    """
    try:
        # 도구 존재 확인
        tool_check = "SELECT id, name FROM tools WHERE id = :tool_id"
        tool_result = db.execute(text(tool_check), {"tool_id": tool_id})
        tool_row = tool_result.fetchone()
        
        if not tool_row:
            return {
                "success": False,
                "error": {
                    "code": "TOOL_NOT_FOUND",
                    "message": "요청한 도구를 찾을 수 없습니다."
                }
            }
        
        # 벤치마크 종류별 최신 점수
        query = """
        SELECT DISTINCT ON (benchmark_type) 
            benchmark_type, score, source, collected_date
        FROM benchmarks
        WHERE tool_id = :tool_id
        ORDER BY benchmark_type, collected_date DESC
        """
        
        result = db.execute(text(query), {"tool_id": tool_id})
        benchmarks = {}
        
        for row in result.fetchall():
            benchmarks[row[0]] = {
                "score": float(row[1]),
                "source": row[2],
                "collected_date": str(row[3]) if row[3] else None
            }
        
        # 평균 점수
        if benchmarks:
            avg_score = sum(b["score"] for b in benchmarks.values()) / len(benchmarks)
        else:
            avg_score = 0
        
        return {
            "success": True,
            "data": {
                "tool_id": tool_id,
                "tool_name": tool_row[1],
                "benchmarks": benchmarks,
                "average_score": round(avg_score, 2)
            }
        }
    
    except Exception:
        logger.exception("벤치마크 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }

# ==================== 벤치마크 종류 목록 ====================
@router.get("/types")
def get_benchmark_types(db: Session = Depends(get_db)):
    """
    사용 가능한 모든 벤치마크 종류 목록
    """
    try:
        query = """
        SELECT DISTINCT benchmark_type, COUNT(*) as count
        FROM benchmarks
        GROUP BY benchmark_type
        ORDER BY benchmark_type
        """
        
        result = db.execute(text(query))
        types = [
            {
                "type": row[0],
                "count": row[1]
            }
            for row in result.fetchall()
        ]
        
        return {
            "success": True,
            "data": types
        }
    
    except Exception:
        logger.exception("벤치마크 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }
