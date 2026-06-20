import logging
import uuid

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

logger = logging.getLogger(__name__)


# ==================== 에러 식별자 + 공통 에러 응답 ====================
def new_error_id() -> str:
    """응답↔로그를 연결하는 짧은 상관관계 ID(8 hex)."""
    return uuid.uuid4().hex[:8]


def db_error(
    log: logging.Logger,
    operation: str,
    *,
    code: str = "DATABASE_ERROR",
    message: str = "데이터베이스 조회 중 오류가 발생했습니다.",
) -> dict:
    """라우터 ``except Exception`` 블록 공통 에러 응답 빌더.

    반드시 ``except`` 컨텍스트에서 호출한다(``logger.exception`` 이 traceback 캡처).
    같은 ``error_id`` 를 로그 라인과 응답에 함께 남겨, prod 응답의 id 로 로그를 바로
    찾을 수 있게 한다(내부 메시지·traceback 은 응답에 노출하지 않음).

    log 은 호출 라우터의 로거를 넘긴다 — 로그에 모듈명(어느 라우터인지)이 남도록.
    """
    err_id = new_error_id()
    log.exception("%s [err_id=%s code=%s]", operation, err_id, code)
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "error_id": err_id},
    }


# ==================== 커스텀 예외 ====================
class AIToolsException(Exception):
    """기본 커스텀 예외"""
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

class ToolNotFound(AIToolsException):
    """도구를 찾을 수 없음"""
    def __init__(self, message: str = "요청한 도구를 찾을 수 없습니다."):
        super().__init__("TOOL_NOT_FOUND", message, 404)

class InvalidParameters(AIToolsException):
    """잘못된 파라미터"""
    def __init__(self, message: str = "잘못된 파라미터입니다."):
        super().__init__("INVALID_PARAMETERS", message, 400)

class DatabaseError(AIToolsException):
    """데이터베이스 에러"""
    def __init__(self, message: str = "데이터베이스 조회 중 오류가 발생했습니다."):
        super().__init__("DATABASE_ERROR", message, 500)

class AuthenticationError(AIToolsException):
    """인증 오류"""
    def __init__(self, message: str = "인증 실패했습니다."):
        super().__init__("AUTHENTICATION_ERROR", message, 401)

class RateLimitError(AIToolsException):
    """요청 한도 초과"""
    def __init__(self, message: str = "요청 한도를 초과했습니다."):
        super().__init__("RATE_LIMIT_EXCEEDED", message, 429)

# ==================== 예외 핸들러 등록 ====================
def register_exception_handlers(app: FastAPI):
    """FastAPI 앱에 예외 핸들러 등록"""
    
    # 커스텀 예외 핸들러
    @app.exception_handler(AIToolsException)
    async def aitools_exception_handler(request: Request, exc: AIToolsException):
        error = {"code": exc.code, "message": exc.message}
        # 4xx(ToolNotFound·InvalidParameters 등)는 예상된 클라이언트 오류라 식별자가
        # 필요 없다. 5xx(DatabaseError 등 서버측)만 error_id 를 붙이고 traceback 을
        # 로깅해, 응답의 id 로 로그를 추적할 수 있게 한다.
        if exc.status_code >= 500:
            err_id = new_error_id()
            error["error_id"] = err_id
            logger.error(
                "AIToolsException %s [err_id=%s path=%s]",
                exc.code, err_id, request.url.path, exc_info=exc,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "data": None, "error": error},
        )
    
    # 검증 오류 핸들러
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        errors = []
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(x) for x in error["loc"][1:]),
                "message": error["msg"]
            })
        
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "요청 데이터 검증 실패",
                    "details": errors
                }
            }
        )
    
    # 일반 예외 핸들러 — 라우터에서 catch 되지 않고 올라온 예외.
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        # 이전에는 아무것도 로깅하지 않아 원인 추적이 불가능했다. error_id +
        # traceback + 요청 경로를 남겨 식별 가능하게 한다.
        err_id = new_error_id()
        logger.error(
            "처리되지 않은 예외 [err_id=%s path=%s]",
            err_id, request.url.path, exc_info=exc,
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "서버 내부 오류가 발생했습니다.",
                    "error_id": err_id,
                },
            },
        )
