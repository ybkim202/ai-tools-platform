from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# PostgreSQL 연결
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()  # .strip() 추가!

# 기동 검증: DATABASE_URL 미설정 시 create_engine("") 으로 모호하게 실패하지 않고
# import 시점에 명확한 메시지로 즉시 중단한다. (정상 설정 시 동작은 동일)
if not DATABASE_URL:
    raise RuntimeError(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "PostgreSQL 연결 문자열(DATABASE_URL)을 환경변수로 주입하세요. "
        "비밀정보는 소스/커밋에 하드코딩하지 마세요."
    )

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """데이터베이스 세션 반환"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
