"""이벤트 수집 라우터 — POST /api/events.

목적
----
About 페이지 등의 1st-party 클릭 전환(CTA 클릭)을 비식별 계측한다. 프론트
(services/api.js 의 trackEvent → About.jsx)가 fire-and-forget 으로 보내는
{name, target, path} 를 받아 events 테이블에 1행 INSERT 한다.

개인정보(헌법 G9)
-----------------
IP 주소 / User-Agent 등 식별 가능 정보는 절대 수집하지 않는다. 라우터는
request.client.host 나 User-Agent 헤더를 읽지 않으며, referrer 는 nullable 이고
프론트는 현재 전송하지 않는다(향후 확장 여지만 둔다).

보안(헌법 G7)
-------------
- 모든 DB 접근은 SQLAlchemy text() 의 :name 바인딩만 사용한다(%(name)s / 포매팅 금지).
- 공개 무인증 쓰기 엔드포인트이므로 레이트 리미팅(main.py 에서 일괄 적용)이 필수다.
- name/target 은 화이트리스트·정규식으로 엄격 검증한다(임의 값 적재 방지).
- 클라이언트가 보낸 path/target 은 응답·로그에 에코백하지 않는다(reflected 정보 노출 방지).

응답 계약
---------
항상 {success, data, error} 포맷. 성공 시 data 는 식별자 없이 최소 정보만 담는다.
프론트는 응답을 사용하지 않고 모든 실패를 침묵 처리하므로, 에러도 표준 포맷만 지키면 된다.
"""

import logging
import re
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..database import get_db
from ..exceptions import DatabaseError, InvalidParameters

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/events", tags=["events"])

# 허용 name 화이트리스트. 현재는 About CTA 클릭 단일 이벤트만 수집한다.
# 새 이벤트를 추가할 때 이 집합에 명시적으로 등록한다(임의 name 적재 방지).
_ALLOWED_NAMES = frozenset({"about_cta_click"})

# target 토큰 형식: 소문자 영숫자/언더스코어 1~40자.
_TARGET_RE = re.compile(r"^[a-z0-9_]{1,40}$")

# path 최대 길이(테이블 VARCHAR(256) 와 일치).
_MAX_PATH_LEN = 256


class EventIn(BaseModel):
    """이벤트 수집 요청 바디.

    Attributes:
        name: 이벤트 종류. 화이트리스트(_ALLOWED_NAMES)로 제한.
        target: 클릭 대상 식별 토큰. ^[a-z0-9_]{1,40}$.
        path: 이벤트 발생 경로(window.location.pathname). 길이 <= 256.
    """

    name: str
    target: str
    path: str


@router.post("")
def create_event(payload: EventIn, db: Session = Depends(get_db)):
    """클릭 전환 이벤트 1건을 events 테이블에 저장한다.

    검증을 통과하면 1행을 INSERT 하고 식별자 없는 최소 성공 응답을 반환한다.
    검증 실패는 InvalidParameters(400), DB 오류는 DatabaseError(500)로 처리하며
    둘 다 exceptions.py 핸들러가 {success, data, error} 포맷으로 직렬화한다.

    Args:
        payload: 검증 대상 요청 바디.
        db: 주입된 DB 세션.

    Returns:
        성공 시 {"success": True, "data": {"recorded": True}, "error": None}.

    Raises:
        InvalidParameters: 화이트리스트/정규식/길이 검증 실패 시.
        DatabaseError: INSERT 중 예외 발생 시.
    """
    # ---------- 입력 검증(화이트리스트 우선) ----------
    name = payload.name
    target = payload.target
    path = payload.path

    if name not in _ALLOWED_NAMES:
        # 에러 메시지에 클라이언트 입력값을 에코백하지 않는다.
        raise InvalidParameters("허용되지 않은 이벤트입니다.")
    if not isinstance(target, str) or not _TARGET_RE.match(target):
        raise InvalidParameters("이벤트 대상 형식이 올바르지 않습니다.")
    if not isinstance(path, str) or not (1 <= len(path) <= _MAX_PATH_LEN):
        raise InvalidParameters("이벤트 경로 형식이 올바르지 않습니다.")

    # ---------- 저장(파라미터 바인딩) ----------
    # referrer 는 현재 미수집(NULL). IP/User-Agent 등 식별 정보는 의도적으로 저장하지 않는다.
    try:
        db.execute(
            text(
                "INSERT INTO events (name, target, path, referrer) "
                "VALUES (:name, :target, :path, :referrer)"
            ),
            {"name": name, "target": target, "path": path, "referrer": None},
        )
        db.commit()
    except Exception:
        db.rollback()
        # 클라이언트 입력값을 로그에 남기지 않는다(name 만 화이트리스트 통과값이라 안전).
        logger.exception("이벤트 저장 중 오류 발생 (name=%s)", name)
        raise DatabaseError("이벤트 저장 중 오류가 발생했습니다.")

    return {"success": True, "data": {"recorded": True}, "error": None}
