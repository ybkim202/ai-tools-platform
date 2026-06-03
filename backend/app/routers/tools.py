import logging

from fastapi import APIRouter, Query, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from datetime import datetime
from ..database import get_db
from ..exceptions import ToolNotFound

logger = logging.getLogger(__name__)

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
        #
        # 불변식(MUST 준수): `query` 문자열에는 정적 SQL 조각만 누적한다.
        # 사용자 입력은 절대 query 에 직접 보간하지 않고 오직 `params` 의
        # `:name` 바인딩으로만 전달한다. 아래 count_query 가 `query` 를 서브쿼리로
        # 감싸므로(f-string), query 에 값이 직접 삽입되면 SQL Injection 회귀가
        # 발생할 수 있다. 새 필터/정렬 추가 시 반드시 바인딩만 사용할 것.
        query = "SELECT * FROM tools WHERE 1=1"
        params = {}
        
        # 필터링
        if search:
            # 검색 범위: 이름·설명·카테고리·태그(task/profession). 사용자 입력은
            # 전부 :search 바인딩 1개로만 전달하므로 인젝션 불변식 유지(아래 query
            # 누적은 정적 조각뿐). 태그는 tool_tags⨝tags 서브쿼리로 매칭.
            query += (
                " AND ("
                "name ILIKE :search"
                " OR description ILIKE :search"
                " OR category ILIKE :search"
                " OR tools.id IN ("
                "SELECT tt.tool_id FROM tool_tags tt"
                " JOIN tags t ON tt.tag_id = t.id"
                " WHERE t.name ILIKE :search)"
                ")"
            )
            params["search"] = f"%{search}%"

        if category:
            query += " AND category = :category"
            params["category"] = category

        if country:
            query += " AND country = :country"
            params["country"] = country

        if difficulty:
            query += " AND difficulty = :difficulty"
            params["difficulty"] = difficulty

        if min_price is not None:
            query += " AND (SELECT MIN(price) FROM pricing WHERE tool_id = tools.id) >= :min_price"
            params["min_price"] = min_price

        if max_price is not None:
            query += " AND (SELECT MAX(price) FROM pricing WHERE tool_id = tools.id) <= :max_price"
            params["max_price"] = max_price

        if min_users is not None:
            query += " AND user_count >= :min_users"
            params["min_users"] = min_users

        if max_users is not None:
            query += " AND user_count <= :max_users"
            params["max_users"] = max_users
        
        # 정렬
        #
        # 불변식(MUST 준수): sort_by 는 사용자 자유 입력이므로 ORDER BY 절에 절대
        # 직접 보간하지 않는다. 아래 if/elif 분기는 화이트리스트로 동작하며 각
        # 분기에서 고정된 정적 문자열만 query 에 누적한다. 정의되지 않은 값은
        # 기본값(popularity)으로 폴백한다. (CASE 문도 고정 리터럴만 사용)
        # 검색 시 이름 매칭을 최상단에(타입어헤드 품질). order_prefix 는 정적
        # 리터럴 2종 중 택1이며 :search 는 바인딩 placeholder라 값 보간이 아님(안전).
        order_prefix = "(name ILIKE :search) DESC, " if search else ""
        if sort_by == "price":
            order_key = "(SELECT AVG(price) FROM pricing WHERE tool_id = tools.id)"
        elif sort_by == "recent":
            order_key = "updated_at DESC"
        elif sort_by == "name":
            order_key = "tools.name ASC"
        elif sort_by == "difficulty":
            order_key = (
                "CASE difficulty"
                " WHEN '쉬움' THEN 1"
                " WHEN '보통' THEN 2"
                " WHEN '어려움' THEN 3"
                " ELSE 4 END, user_count DESC"
            )
        else:
            # popularity(기본) 및 정의되지 않은 모든 값
            order_key = "user_count DESC"
        query += " ORDER BY " + order_prefix + order_key
        
        # 전체 개수 조회
        # f-string 으로 `query` 를 서브쿼리로 감싸지만, 위 불변식에 따라 `query` 는
        # 정적 조각만 포함하고 사용자 입력은 전부 `params` 바인딩으로 들어간다.
        # 따라서 보간되는 문자열에는 값이 없어 SQL Injection 위험이 없다.
        # (정렬/페이징 절은 이 시점 이후에 query 에 추가되므로 count 대상에서 제외됨)
        count_query = f"SELECT COUNT(*) FROM ({query}) as counted"
        total_result = db.execute(text(count_query), params)
        total = total_result.scalar()
        
        # 페이징 적용
        query += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset

        # 도구 조회
        result = db.execute(text(query), params)
        # 인기지표(github_stars/hn_points)는 컬럼명으로 접근한다(SELECT * 이지만
        # ALTER 로 뒤에 추가된 컬럼이라 위치 인덱스 대신 _mapping.get 로 안전 접근.
        # 마이그레이션 전 DB 면 키가 없어 None 이 되며 깨지지 않는다).
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
                "updated_at": str(row[12]),
                "github_stars": row._mapping.get("github_stars"),
                "hn_points": row._mapping.get("hn_points"),
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
    
    except Exception:
        logger.exception("도구 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }

# ==================== Tools 메타 (필터 옵션) ====================
# 주의: 경로 매칭 우선순위 때문에 반드시 "/{tool_id}" 보다 위에 등록한다.
# 그렇지 않으면 "meta" 가 tool_id 로 파싱되어 422/404 가 발생한다.
@router.get("/meta")
def get_tools_meta(db: Session = Depends(get_db)):
    """
    필터 옵션 메타데이터 조회.

    프론트(Home/Recommendations)의 필터 옵션값을 DB 실제값과 동기화하기 위한
    distinct 목록을 반환한다. 하드코딩된 옵션 목록 제거 근거.

    Returns:
        {success, data: {categories, tags, difficulties, tasks, professions}, error}
        - categories: tools.category 의 distinct (null 제외, 정렬)
        - tags: tags.name 의 distinct (tags 테이블, null 제외, 정렬) — 평면(하위호환)
        - difficulties: tools.difficulty 의 distinct (null 제외, 정렬)
        - tasks: tags.type = 'task' 인 name 의 distinct (null 제외, 정렬)
        - professions: tags.type = 'profession' 인 name 의 distinct (null 제외, 정렬)
        - total_tools: tools 테이블 전체 행 수 (정수) — About 페이지 앵커 수치
        - total_categories: distinct category 개수 (= len(categories), 정수)
    """
    try:
        category_rows = db.execute(
            text(
                "SELECT DISTINCT category FROM tools "
                "WHERE category IS NOT NULL AND category <> '' "
                "ORDER BY category"
            )
        ).fetchall()
        categories = [row[0] for row in category_rows]

        difficulty_rows = db.execute(
            text(
                "SELECT DISTINCT difficulty FROM tools "
                "WHERE difficulty IS NOT NULL AND difficulty <> '' "
                "ORDER BY difficulty"
            )
        ).fetchall()
        difficulties = [row[0] for row in difficulty_rows]

        # name, type 을 한 번에 조회해 파이썬에서 분류(쿼리 수 최소화).
        # type 분기는 고정 리터럴('task'/'profession')만 사용 — 사용자 입력 보간 없음.
        tag_rows = db.execute(
            text(
                "SELECT DISTINCT name, type FROM tags "
                "WHERE name IS NOT NULL AND name <> '' "
                "ORDER BY name"
            )
        ).fetchall()
        tags = [row[0] for row in tag_rows]
        tasks = [row[0] for row in tag_rows if row[1] == "task"]
        professions = [row[0] for row in tag_rows if row[1] == "profession"]

        # About 페이지 Hero 앵커 수치용 실데이터 카운트.
        # 고정 SQL(사용자 입력 보간 없음). total_categories 는 추가 쿼리 없이
        # 위 distinct categories 길이를 재사용한다.
        total_tools = db.execute(text("SELECT COUNT(*) FROM tools")).scalar() or 0
        total_categories = len(categories)

        return {
            "success": True,
            "data": {
                "categories": categories,
                "tags": tags,
                "difficulties": difficulties,
                "tasks": tasks,
                "professions": professions,
                "total_tools": int(total_tools),
                "total_categories": total_categories,
            },
            "error": None,
        }

    except Exception:
        logger.exception("메타데이터 조회 중 오류 발생")
        return {
            "success": False,
            "data": None,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다.",
            },
        }


# ==================== Tools 상세 조회 ====================
@router.get("/{tool_id}")
def get_tool_detail(tool_id: int, db: Session = Depends(get_db)):
    """특정 도구의 상세 정보 조회"""
    try:
        # 도구 정보 조회
        tool_query = "SELECT * FROM tools WHERE id = :tool_id"
        tool_result = db.execute(text(tool_query), {"tool_id": tool_id})
        tool_row = tool_result.fetchone()
        
        if not tool_row:
            # HTTP 404 로 통일 (예외 핸들러가 {success:false, data:null, error:{...}} 로 변환)
            raise ToolNotFound()

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
            # 인기지표(컬럼명 접근 — ALTER 로 뒤에 추가된 컬럼, 마이그레이션 전엔 None).
            "github_stars": tool_row._mapping.get("github_stars"),
            "hn_points": tool_row._mapping.get("hn_points"),
            "source": tool_row._mapping.get("source"),
        }
        
        # 태그 조회 (task / profession 분류)
        # tool_tags ⨝ tags 를 tool_id 한 번으로 조회 후 type 별로 분류.
        tag_query = """
        SELECT tg.name, tg.type
        FROM tool_tags tt
        INNER JOIN tags tg ON tt.tag_id = tg.id
        WHERE tt.tool_id = :tool_id
        ORDER BY tg.name
        """
        tag_result = db.execute(text(tag_query), {"tool_id": tool_id})
        tasks = []
        professions = []
        for tag_name, tag_type in tag_result.fetchall():
            if tag_type == "task":
                tasks.append(tag_name)
            elif tag_type == "profession":
                professions.append(tag_name)

        # 벤치마크 조회
        benchmark_query = "SELECT id, benchmark_type, score, source, collected_date FROM benchmarks WHERE tool_id = :tool_id"
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
        pricing_query = "SELECT id, plan_name, price, currency, billing_period, description FROM pricing WHERE tool_id = :tool_id"
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
        news_query = "SELECT id, title, content, news_date, source_url FROM news WHERE tool_id = :tool_id ORDER BY news_date DESC LIMIT 5"
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
                "tasks": tasks,
                "professions": professions,
                "benchmarks": benchmarks,
                "pricing": pricing,
                "recent_news": news
            }
        }

    except ToolNotFound:
        # 커스텀 예외는 핸들러(HTTP 404)로 전달되도록 재발생
        raise
    except Exception:
        logger.exception("도구 조회 중 오류 발생")
        return {
            "success": False,
            "error": {
                "code": "DATABASE_ERROR",
                "message": "데이터베이스 조회 중 오류가 발생했습니다."
            }
        }
