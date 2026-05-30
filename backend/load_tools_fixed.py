import json
import psycopg2
from psycopg2 import sql
from datetime import datetime
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv()

# PostgreSQL 연결정보
# NEVER: 접속 문자열(비밀번호 포함)을 소스에 하드코딩하지 않는다(헌법 G9).
# 과거 이 줄에 노출됐던 크리덴셜은 폐기(rotate) 필요. 반드시 환경변수로만 주입한다.
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise SystemExit(
        "환경변수 DATABASE_URL 이 설정되지 않았습니다. "
        "예) DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB python load_tools_fixed.py"
    )

# JSON 파일 로드
def load_tools_from_json(filename='tools_data.json'):
    """JSON 파일에서 도구 데이터 로드"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            tools = json.load(f)
        print(f"✅ JSON 파일에서 {len(tools)}개 도구 로드 완료")
        return tools
    except FileNotFoundError:
        print(f"❌ 파일을 찾을 수 없습니다: {filename}")
        return []
    except json.JSONDecodeError:
        print(f"❌ JSON 파일 형식이 잘못되었습니다")
        return []

# PostgreSQL 연결
def connect_db():
    """PostgreSQL 데이터베이스 연결"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print("✅ PostgreSQL 연결 성공")
        return conn
    except psycopg2.Error as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        return None

# billing_period 유효성 검사
def validate_billing_period(period):
    """billing_period 값 검증 및 변환"""
    valid_periods = ['monthly', 'annual', 'onetime', 'free']
    
    if period in valid_periods:
        return period
    
    # 유효하지 않은 값은 매핑
    period_mapping = {
        'per_image': 'monthly',
        'per_use': 'monthly',
        'pay_as_you_go': 'monthly',
        'subscription': 'monthly',
        'custom': 'annual'
    }
    
    return period_mapping.get(period, 'monthly')

# 도구 데이터 저장
def save_tools_to_db(conn, tools):
    """도구 데이터를 데이터베이스에 저장"""
    if not conn:
        return
    
    cursor = conn.cursor()
    inserted_count = 0
    updated_count = 0
    error_count = 0
    
    for tool in tools:
        try:
            # 도구 정보 추출
            name = tool.get('name')
            logo_url = tool.get('logo_url')
            official_url = tool.get('official_url')
            description = tool.get('description')
            category = tool.get('category')
            country = tool.get('country')
            difficulty = tool.get('difficulty')
            user_count = tool.get('user_count')
            user_count_source = tool.get('user_count_source')
            user_count_date = datetime.now()
            
            # 중복 확인 및 INSERT/UPDATE
            check_query = "SELECT id FROM tools WHERE name = %s"
            cursor.execute(check_query, (name,))
            existing_tool = cursor.fetchone()
            
            if existing_tool:
                # UPDATE
                update_query = """
                UPDATE tools 
                SET logo_url = %s,
                    official_url = %s,
                    description = %s,
                    category = %s,
                    country = %s,
                    difficulty = %s,
                    user_count = %s,
                    user_count_source = %s,
                    user_count_date = %s,
                    updated_at = %s
                WHERE name = %s
                """
                cursor.execute(update_query, (
                    logo_url, official_url, description, category, country,
                    difficulty, user_count, user_count_source, user_count_date,
                    datetime.now(), name
                ))
                updated_count += 1
            else:
                # INSERT
                insert_query = """
                INSERT INTO tools 
                (name, logo_url, official_url, description, category, country, 
                 difficulty, user_count, user_count_source, user_count_date, 
                 created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """
                cursor.execute(insert_query, (
                    name, logo_url, official_url, description, category, country,
                    difficulty, user_count, user_count_source, user_count_date,
                    datetime.now(), datetime.now()
                ))
                tool_id = cursor.fetchone()[0]
                inserted_count += 1
                
                # 가격 정보 저장
                pricing_list = tool.get('pricing', [])
                for pricing in pricing_list:
                    try:
                        # billing_period 유효성 검사
                        billing_period = validate_billing_period(
                            pricing.get('billing_period')
                        )
                        
                        pricing_query = """
                        INSERT INTO pricing 
                        (tool_id, plan_name, price, currency, billing_period, description)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """
                        cursor.execute(pricing_query, (
                            tool_id,
                            pricing.get('plan_name'),
                            pricing.get('price'),
                            pricing.get('currency'),
                            billing_period,
                            pricing.get('description', '')
                        ))
                    except Exception as e:
                        print(f"⚠️  {name}의 가격 정보 저장 실패: {e}")
            
            # 각 도구마다 커밋 (트랜잭션 에러 방지)
            conn.commit()
        
        except psycopg2.IntegrityError as e:
            conn.rollback()
            error_count += 1
            print(f"⚠️  {tool.get('name', 'Unknown')} 저장 중 제약 조건 위반: {e}")
        except Exception as e:
            conn.rollback()
            error_count += 1
            print(f"⚠️  {tool.get('name', 'Unknown')} 저장 실패: {e}")
    
    print(f"\n✅ 저장 완료")
    print(f"   - 새로 추가: {inserted_count}개")
    print(f"   - 업데이트: {updated_count}개")
    print(f"   - 에러: {error_count}개")

# 저장된 도구 확인
def verify_data(conn):
    """데이터베이스에 저장된 도구 확인"""
    if not conn:
        return
    
    cursor = conn.cursor()
    
    try:
        # 총 도구 개수
        cursor.execute("SELECT COUNT(*) FROM tools")
        total_tools = cursor.fetchone()[0]
        
        # 카테고리별 도구 개수
        cursor.execute("""
            SELECT category, COUNT(*) as count 
            FROM tools 
            GROUP BY category 
            ORDER BY count DESC
        """)
        categories = cursor.fetchall()
        
        print(f"\n📊 데이터 검증")
        print(f"   - 총 도구 개수: {total_tools}개")
        print(f"   - 카테고리별 분포:")
        for category, count in categories:
            print(f"     • {category}: {count}개")
        
        # 샘플 도구 조회
        cursor.execute("""
            SELECT id, name, category, user_count 
            FROM tools 
            LIMIT 5
        """)
        samples = cursor.fetchall()
        
        if samples:
            print(f"\n   - 샘플 도구:")
            for tool_id, name, category, user_count in samples:
                print(f"     • {name} ({category}) - {user_count:,} users" if user_count else f"     • {name} ({category})")
        
    except Exception as e:
        print(f"❌ 데이터 검증 실패: {e}")
    
    cursor.close()

# 메인 함수
def main():
    """메인 실행 함수"""
    print("=" * 60)
    print("🚀 AI 도구 데이터 저장 스크립트 (수정버전)")
    print("=" * 60)
    
    # 1. JSON 파일 로드
    print("\n[1단계] JSON 파일 로드")
    tools = load_tools_from_json('tools_data.json')
    
    if not tools:
        print("❌ 도구 데이터를 로드할 수 없습니다")
        return
    
    # 2. 데이터베이스 연결
    print("\n[2단계] 데이터베이스 연결")
    conn = connect_db()
    
    if not conn:
        print("❌ 데이터베이스에 연결할 수 없습니다")
        return
    
    # 3. 데이터 저장
    print("\n[3단계] 데이터 저장 중...")
    save_tools_to_db(conn, tools)
    
    # 4. 데이터 검증
    print("\n[4단계] 데이터 검증")
    verify_data(conn)
    
    # 5. 연결 종료
    conn.close()
    print("\n" + "=" * 60)
    print("✅ 모든 작업 완료!")
    print("=" * 60)

if __name__ == "__main__":
    main()
