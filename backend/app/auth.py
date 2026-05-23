from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# API Key 설정
API_KEYS = [
    "***REMOVED-API-KEY***",  # 테스트 키
    os.getenv("API_KEY", "your-secret-api-key")  # 환경변수에서 읽기
]

# API Key 헤더 정의
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# ==================== 인증 함수 ====================
async def verify_api_key(api_key: str = Depends(api_key_header)):
    """
    API Key 검증
    
    X-API-Key 헤더가 없거나 유효하지 않으면 None 반환
    이를 통해 선택적 인증 구현
    """
    if api_key is None:
        return None
    
    if api_key not in API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_API_KEY",
                    "message": "유효하지 않은 API Key입니다."
                }
            }
        )
    
    return api_key

async def require_api_key(api_key: str = Depends(api_key_header)):
    """
    필수 API Key 검증
    
    인증이 필수인 엔드포인트에 사용
    """
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_API_KEY",
                    "message": "X-API-Key 헤더가 필요합니다."
                }
            }
        )
    
    if api_key not in API_KEYS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "success": False,
                "error": {
                    "code": "INVALID_API_KEY",
                    "message": "유효하지 않은 API Key입니다."
                }
            }
        )
    
    return api_key

# ==================== 레이트 리미팅 ====================
from datetime import datetime, timedelta
from collections import defaultdict

# 간단한 인메모리 레이트 리미팅 (프로덕션에선 Redis 사용)
request_counts = defaultdict(list)
RATE_LIMIT_REQUESTS = 100  # 분당 요청 수
RATE_LIMIT_PERIOD = 60  # 초 단위

def check_rate_limit(api_key: str = None):
    """
    요청 횟수 제한 확인
    """
    key = api_key or "anonymous"
    now = datetime.now()
    
    # 오래된 요청 제거
    request_counts[key] = [
        req_time for req_time in request_counts[key]
        if (now - req_time).seconds < RATE_LIMIT_PERIOD
    ]
    
    # 한도 초과 확인
    if len(request_counts[key]) >= RATE_LIMIT_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "success": False,
                "error": {
                    "code": "RATE_LIMIT_EXCEEDED",
                    "message": f"분당 {RATE_LIMIT_REQUESTS}개 요청으로 제한됩니다."
                }
            }
        )
    
    # 현재 요청 기록
    request_counts[key].append(now)
    
    return True
