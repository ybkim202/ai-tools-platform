from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routers import tools, recommendations, compare, news, benchmarks
from app.exceptions import register_exception_handlers
from app.auth import verify_api_key, check_rate_limit
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 도메인 허용 (프로덕션에선 구체적으로 설정)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 예외 핸들러 등록 ====================
register_exception_handlers(app)

# ==================== 라우터 등록 ====================
app.include_router(tools.router)
app.include_router(recommendations.router)
app.include_router(compare.router)
app.include_router(news.router)
app.include_router(benchmarks.router)

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
            "benchmark_types": "/api/benchmarks/types"
        }
    }

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
