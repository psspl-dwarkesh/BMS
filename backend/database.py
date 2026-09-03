"""
Database engine and session factory.

SQLite-specific hardening applied at connect time:
  - WAL journal mode   — lets the simulator write while HTTP reads run concurrently
  - foreign_keys = ON  — enforces FK constraints SQLite ignores by default
  - busy_timeout       — avoids "database is locked" errors under concurrent writers

The PRAGMA block is guarded so it is silently skipped on a non-SQLite URL
(e.g. a future PostgreSQL swap), where these pragmas are not valid SQL.
"""
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import settings


engine = create_engine(
    settings.DATABASE_URL,
    # SQLite requires check_same_thread=False when used from multiple threads
    # (e.g. the asyncio simulator calling sync SQLAlchemy via run_in_executor).
    # This kwarg is silently ignored by other dialects.
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _connection_record):
    """Apply SQLite-specific hardening on every new raw connection."""
    # Guard: only run on SQLite connections (they expose .isolation_level).
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")   # ms — wait up to 5s before raising
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and guarantees it closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
