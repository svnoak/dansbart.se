from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

# 1. Create the Engine (The connection pool)
engine = create_engine(
    str(settings.SQLALCHEMY_DATABASE_URI), 
    pool_pre_ping=True # Auto-reconnect if DB connection drops
)

# 2. Create the Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Create the Base Class for Models
class Base(DeclarativeBase):
    pass

# 4. Dependency for FastAPI (Web Request Lifecycle)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()