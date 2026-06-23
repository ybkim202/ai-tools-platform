from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tools, recommendations, compare, news, benchmarks, trends, events
from app.exceptions import register_exception_handlers
from app.auth import verify_api_key, rate_limit_dependency
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# FastAPI 앱 생성
app = FastAPI(
    title="AITools API",
    description="AI 도구 비교 플랫폼",
    version="1.0.0"
)

# ==================== CORS 설정 ====================
# 허용 오리진은 환경변수 ALLOWED_ORIGINS(콤마 구분)로 주입한다.
# 미설정 시 로컬 개발 기본값을 사용한다. 와일드카드("*")는 사용하지 않는다.
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

# 정규식 오리진(선택). Vercel 프리뷰는 커밋마다 도메인이 바뀌어
# (ai-tools-platform-git-<브랜치>-<해시>-<팀>.vercel.app) 정확 일치 목록으로는
# 매번 등록할 수 없다. ALLOWED_ORIGIN_REGEX 로 프로젝트 프리뷰 패턴을 허용한다.
#   예) ALLOWED_ORIGIN_REGEX=https://ai-tools-platform-.*\.vercel\.app
# 프로젝트명으로 스코프를 좁혀 임의의 *.vercel.app 을 열지 않는다(allow_credentials
# 가 False 이고 공개 읽기 데이터라 위험은 낮지만 최소 권한 유지). 미설정 시 None →
# 정규식 매칭 비활성(기존 정확 일치 목록만 동작).
allowed_origin_regex = os.getenv("ALLOWED_ORIGIN_REGEX", "").strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allowed_origin_regex,
    # 프론트는 쿠키/크레덴셜을 사용하지 않으므로 False 로 둔다.
    allow_credentials=False,
    # 최소 권한: 실제 사용하는 메서드/헤더만 허용한다.
    # - 조회 엔드포인트는 GET, 전환 계측(POST /api/events)은 POST 를 사용한다(OPTIONS 는 프리플라이트용).
    # - 요청 헤더는 JSON 바디용 Content-Type 과 선택적 인증용 X-API-Key 만 사용한다.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ==================== 예외 핸들러 등록 ====================
register_exception_handlers(app)

# ==================== 라우터 등록 ====================
# 공개(무인증) 엔드포인트지만 IP 기준 레이트 리미팅을 적용한다.
# (인메모리 방식이므로 다중 워커 환경에서는 워커별 독립 집계 — 정밀 제한 아님)
_rate_limit = [Depends(rate_limit_dependency)]
app.include_router(tools.router, dependencies=_rate_limit)
app.include_router(recommendations.router, dependencies=_rate_limit)
app.include_router(compare.router, dependencies=_rate_limit)
app.include_router(news.router, dependencies=_rate_limit)
app.include_router(benchmarks.router, dependencies=_rate_limit)
app.include_router(trends.router, dependencies=_rate_limit)
# 공개 무인증 쓰기(전환 계측)라 레이트 리미팅이 특히 중요하다.
app.include_router(events.router, dependencies=_rate_limit)

# ==================== 루트 엔드포인트 ====================
@app.get("/")
def root():
    """API 기본 정보"""
    return {
        "name": "AITools API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "tools": "/api/tools",
            "tool_detail": "/api/tools/{tool_id}",
            "recommendations": "/api/recommendations",
            "compare": "/api/compare",
            "news": "/api/news",
            "trending_news": "/api/news/trending",
            "benchmarks": "/api/benchmarks",
            "benchmark_summary": "/api/benchmarks/summary/{tool_id}",
            "benchmark_types": "/api/benchmarks/types",
            "github_trending": "/api/trends/github",
            "events": "/api/events"
        }
    }

# ==================== 자동 수집 스케줄러 (기본 비활성) ====================
# scheduler.start_scheduler() 는 ENABLE_SCHEDULER=true 이고
# SCHEDULER_WORKER=true 인 프로세스에서만 잡을 띄운다(멀티워커 중복 방지).
# 그 외에는 None 을 반환하며 앱은 스케줄러 없이 정상 기동한다.
# (collectors/scheduler 는 startup 안에서 lazy import 하여, apscheduler 미설치 시에도
#  앱 import 자체가 깨지지 않게 한다.)
@app.on_event("startup")
def _startup_scheduler():
    """앱 기동 시 가드를 통과하면 자동 수집 스케줄러를 시작한다."""
    try:
        from scheduler import start_scheduler

        start_scheduler()
    except Exception:
        # 스케줄러 기동 실패가 웹 앱 기동을 막지 않도록 격리한다.
        import logging

        logging.getLogger(__name__).exception("스케줄러 기동 실패(앱은 계속 기동)")


@app.on_event("shutdown")
def _shutdown_scheduler():
    """앱 종료 시 스케줄러를 안전하게 정리한다."""
    try:
        from scheduler import shutdown_scheduler

        shutdown_scheduler()
    except Exception:
        pass


@app.get("/health")
def health_check(api_key = Depends(verify_api_key)):
    """
    헬스 체크
    선택적 인증 (API Key 있으면 검증)
    """
    return {
        "status": "ok",
        "authenticated": api_key is not None
    }

# ==================== 서버 실행 ====================
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
