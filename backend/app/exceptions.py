from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

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
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": exc.code,
                    "message": exc.message
                }
            }
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
    
    # 일반 예외 핸들러
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "서버 내부 오류가 발생했습니다."
                }
            }
        )
