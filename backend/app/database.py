from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# PostgreSQL 연결
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://aitools_9ob0_user:lZ2zMiAAGaDKwP7iNzF2XQhjA3N3Npjp@dpg-d889pgbtqb8s7387scf0-a.singapore-postgres.render.com/aitools_9ob0")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """데이터베이스 세션 반환"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
