from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()


def _load_api_keys() -> set:
    """
    유효한 API Key 목록을 환경변수에서만 로드한다.

    - ``API_KEYS``: 콤마로 구분된 키 목록 (권장)
    - ``API_KEY``: 단일 키 (하위 호환)

    소스에 키 리터럴을 하드코딩하지 않으며, 환경변수가 비어 있으면
    유효 키가 존재하지 않는다(폴백 기본값 없음).

    주의: 과거 소스에 하드코딩되어 노출되었던 키는 반드시 폐기(rotate)해야 한다.
    """
    keys: set = set()

    raw_multi = os.getenv("API_KEYS", "")
    for key in raw_multi.split(","):
        key = key.strip()
        if key:
            keys.add(key)

    single = (os.getenv("API_KEY") or "").strip()
    if single:
        keys.add(single)

    return keys


# 유효한 API Key 집합 (환경변수 미설정 시 빈 집합)
API_KEYS = _load_api_keys()

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
        if (now - req_time).total_seconds() < RATE_LIMIT_PERIOD
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


async def rate_limit_dependency(
    request: Request,
    api_key: str = Depends(api_key_header),
):
    """
    IP(또는 API Key) 기준 인메모리 레이트 리미팅 의존성.

    무인증 공개 엔드포인트를 깨지 않도록 키가 있으면 키, 없으면 클라이언트 IP를
    식별자로 사용한다. 한도 초과 시 429 를 반환한다.

    한계: 인메모리 카운터이므로 다중 워커/다중 인스턴스 환경에서는 워커별로
    독립 집계된다(정확한 전역 제한 아님). 정밀 제한이 필요하면 Redis 등 외부
    저장소로 이전해야 한다.

    클라이언트 IP 산출: Railway 등 리버스 프록시 뒤에서는 ``request.client.host``
    가 프록시 IP 로 뭉쳐 전체 사용자가 한 버킷에 묶인다. 이를 피하기 위해
    ``X-Forwarded-For`` 헤더가 있으면 가장 왼쪽(left-most) IP 를 클라이언트로
    사용하고, 없으면 ``request.client.host`` 로 폴백한다. 이는 보안 경계가 아니라
    레이트리밋 식별 용도이며(스푸핑 가능), 신뢰할 수 있는 프록시가 헤더를 설정한다는
    전제에 의존한다.
    """
    client_host = _resolve_client_ip(request)
    identifier = api_key or f"ip:{client_host}"
    check_rate_limit(identifier)
    return True


def _resolve_client_ip(request: Request) -> str:
    """
    레이트리밋용 클라이언트 IP 를 추정한다.

    ``X-Forwarded-For`` 가 있으면 첫 번째(left-most) IP 를, 없으면
    ``request.client.host`` 를 반환한다. 어느 쪽도 없으면 ``"unknown"``.

    주의: 이 값은 신뢰 경계가 아니다(클라이언트가 헤더를 위조 가능).
    레이트리밋 버킷 분리 용도로만 사용한다.
    """
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip

    return request.client.host if request.client else "unknown"
