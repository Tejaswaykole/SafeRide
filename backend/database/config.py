import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured. Add the Supabase PostgreSQL connection string to the local .env file.")

# Handle Supabase / Render / Railway connection string formatting
DATABASE_URL = DATABASE_URL.strip()
if DATABASE_URL.startswith("DATABASE_URL="):
    DATABASE_URL = DATABASE_URL[len("DATABASE_URL="):].strip()
DATABASE_URL = DATABASE_URL.strip("\"'").strip()
DATABASE_URL = DATABASE_URL.replace("[", "").replace("]", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL,
    pool_size=4,
    max_overflow=2,
    pool_recycle=300,
    pool_pre_ping=True
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(declarative_base()):
    __abstract__ = True
