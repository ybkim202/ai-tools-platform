import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from ..database import get_db
from ..exceptions import db_error

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


def max_for_unit(unit):
    """단위에서 만점(천장)을 파생한다 — percent → 100, 그 외(elo 등) → None(상한 없음).

    별도 max_score 컬럼을 두지 않는다: unit 이 이미 척도 천장을 인코딩하므로
    파생이 단일 출처다(헌법 — 무분별 컬럼 추가 금지). 응답에 명시적으로 실어
    프론트가 "/100" 같은 매직넘버를 하드코딩하지 않게 한다(만점 맥락의 SSOT).
    """
    return 100.0 if (unit or "percent") == "percent" else None

# ==================== 벤치마크 조회 ====================
@router.get("")
def get_benchmarks(
    tool_id: int = Query(None, description="특정 도구의 벤치마크만 조회"),
    benchmark_type: str = Query(None, description="벤치마크 종류 (예: GPQA Diamond, MMLU-Pro, SWE-bench Verified, AIME 2025, MMMU, LMArena Elo). 전체 목록은 GET /api/benchmarks/types"),
    sort_by: str = Query("score_desc", description="정렬 기준 (score_desc, score_asc, recent)"),
    limit: int = Query(20, ge=1, le=100, description="최대 결과 수"),
    offset: int = Query(0, ge=0, description="오프셋"),
    db: Session = Depends(get_db)
):
    """
    벤치마크 데이터 조회
    """
    try:
        # 쿼리 빌드. category/model_version/unit 은 additive(기존 필드 뒤에 추가) —
        # 카테고리 섹션·스케일 표시의 근거. 기존 소비자(필드 추가만 보므로) 무영향.
        query = """
        SELECT b.id, b.tool_id, t.name, b.benchmark_type, b.score, b.source,
               b.collected_date, b.category, b.model_version, b.unit, t.logo_url,
               t.official_url
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
                "collected_date": str(row[6]) if row[6] else None,
                "category": row[7],
                "model_version": row[8],
                "unit": row[9] or "percent",
                "max_score": max_for_unit(row[9]),
                "logo_url": row[10],
                # 로고 폴백 체인용: 큐레이션 logo_url 부패 시 프론트가 도메인 파비콘으로
                # 자가치유(resolveLogoSrc/handleLogoError). 표시 전용 파생값.
                "official_url": row[11],
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
        return db_error(logger, "벤치마크 조회 중 오류 발생")

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
        
        # 벤치마크 종류별 최신 점수(같은 type 의 최신 1행). category/model_version/unit additive.
        query = """
        SELECT DISTINCT ON (benchmark_type)
            benchmark_type, score, source, collected_date,
            category, model_version, unit
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
                "collected_date": str(row[3]) if row[3] else None,
                "category": row[4],
                "model_version": row[5],
                "unit": row[6] or "percent",
                "max_score": max_for_unit(row[6]),
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
        return db_error(logger, "벤치마크 조회 중 오류 발생")

# ==================== 벤치마크 종류 목록 ====================
@router.get("/types")
def get_benchmark_types(db: Session = Depends(get_db)):
    """
    사용 가능한 모든 벤치마크 종류 목록
    """
    try:
        # category/unit 을 함께 반환(프론트가 type→category·unit 매핑을 DB 기준으로
        # 가져가도록 — 하드코딩 매핑 제거 근거). 같은 type 은 보통 동일 category/unit.
        query = """
        SELECT benchmark_type,
               MAX(category) AS category,
               MAX(unit) AS unit,
               COUNT(*) AS count
        FROM benchmarks
        GROUP BY benchmark_type
        ORDER BY benchmark_type
        """

        result = db.execute(text(query))
        types = [
            {
                "type": row[0],
                "category": row[1],
                "unit": row[2] or "percent",
                "max_score": max_for_unit(row[2]),
                "count": row[3],
            }
            for row in result.fetchall()
        ]

        return {
            "success": True,
            "data": types
        }

    except Exception:
        return db_error(logger, "벤치마크 조회 중 오류 발생")


# ==================== 카테고리 목록(섹션 메타) ====================
@router.get("/categories")
def get_benchmark_categories(db: Session = Depends(get_db)):
    """벤치마크 카테고리별 메타(섹션 구동용).

    각 category 의 벤치마크 종류 수·행수·unit 을 반환한다. 프론트 벤치마크 페이지가
    카테고리 섹션을 DB 기준으로 구성하도록 한다(하드코딩 목록 금지 — 헌법 G5/G6).
    """
    try:
        query = """
        SELECT category,
               MAX(unit) AS unit,
               COUNT(DISTINCT benchmark_type) AS type_count,
               COUNT(*) AS row_count
        FROM benchmarks
        WHERE category IS NOT NULL
        GROUP BY category
        ORDER BY category
        """
        result = db.execute(text(query))
        categories = [
            {
                "category": row[0],
                "unit": row[1] or "percent",
                "type_count": row[2],
                "row_count": row[3],
            }
            for row in result.fetchall()
        ]
        return {"success": True, "data": categories}

    except Exception:
        return db_error(logger, "벤치마크 카테고리 조회 중 오류 발생")


# ==================== 다축 비교 매트릭스 ====================
@router.get("/matrix")
def get_benchmark_matrix(
    category: str = Query(None, description="카테고리 필터(예: 추론). 미지정+tool_ids 미지정이면 전체"),
    tool_ids: str = Query(None, description="쉼표구분 도구 ID 목록(예: 1,2,3) — 도구 다축 비교용"),
    db: Session = Depends(get_db),
):
    """카테고리(또는 지정 도구들)의 type×tool 최신 점수를 한 번에 반환한다.

    카테고리 섹션·도구 다축 비교(레이더/막대그룹)를 1콜로 구동한다. 같은
    (tool, benchmark_type)은 collected_date 최신 1행만(DISTINCT ON).

    SQL Injection 불변식: category 는 :category 바인딩, tool_ids 는 정수 파싱 후
    :id0,:id1 동적 placeholder 로만 전달(f-string 값 보간 없음).
    응답: {category, types:[{type,unit,max_score}], tools:[{tool_id,tool_name,scores:{type:{score,unit,max_score,model_version,source,collected_date}}}]}
    """
    try:
        where = ["b.category IS NOT NULL"]
        params = {}

        if category:
            where.append("b.category = :category")
            params["category"] = category

        if tool_ids:
            # 정수만 허용(파싱 실패/비정수는 무시). placeholder 동적 생성 — 값은 바인딩.
            ids = []
            for tok in tool_ids.split(","):
                tok = tok.strip()
                if tok.isdigit():
                    ids.append(int(tok))
            if ids:
                names = []
                for idx, val in enumerate(ids):
                    key = f"tid{idx}"
                    names.append(f":{key}")
                    params[key] = val
                where.append("b.tool_id IN (" + ", ".join(names) + ")")

        where_sql = " AND ".join(where)
        query = (
            "SELECT DISTINCT ON (b.tool_id, b.benchmark_type) "
            "  b.tool_id, t.name, b.benchmark_type, b.score, b.unit, "
            "  b.model_version, b.source, b.category, b.collected_date "
            "FROM benchmarks b "
            "INNER JOIN tools t ON b.tool_id = t.id "
            f"WHERE {where_sql} "
            "ORDER BY b.tool_id, b.benchmark_type, b.collected_date DESC"
        )
        rows = db.execute(text(query), params).fetchall()

        # type 메타(unit) 수집 + 도구별 점수 묶음.
        type_unit = {}
        tools_map = {}
        for r in rows:
            tid, tname, btype, score, unit = r[0], r[1], r[2], float(r[3]), (r[4] or "percent")
            model_version, source, collected_date = r[5], r[6], r[8]
            type_unit.setdefault(btype, unit)
            if tid not in tools_map:
                tools_map[tid] = {"tool_id": tid, "tool_name": tname, "scores": {}}
            tools_map[tid]["scores"][btype] = {
                "score": score,
                "unit": unit,
                "max_score": max_for_unit(unit),
                "model_version": model_version,
                "source": source,
                "collected_date": str(collected_date) if collected_date else None,
            }

        types = [
            {"type": t, "unit": u, "max_score": max_for_unit(u)}
            for t, u in sorted(type_unit.items())
        ]
        tools = sorted(tools_map.values(), key=lambda x: x["tool_name"].lower())

        return {
            "success": True,
            "data": {"category": category, "types": types, "tools": tools},
        }

    except Exception:
        return db_error(logger, "벤치마크 매트릭스 조회 중 오류 발생")
