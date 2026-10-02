import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not configured. Add the Supabase PostgreSQL connection string to the local .env file.")

# Some users accidentally leave brackets in the URL placeholder
DATABASE_URL = DATABASE_URL.replace("[", "").replace("]", "")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(declarative_base()):
    __abstract__ = True
