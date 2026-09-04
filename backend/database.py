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


_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    # SQLite requires check_same_thread=False when used from multiple threads
    # (e.g. the asyncio simulator calling sync SQLAlchemy via run_in_executor).
    # This is SQLite-specific (unlike the WAL pragma below, most DBAPI drivers
    # - psycopg included - reject unknown connect() kwargs rather than
    # ignoring them), so it must not be passed at all on a Postgres URL.
    connect_args={"check_same_thread": False} if _is_sqlite else {},
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


def ensure_schema_migrations(engine) -> None:
    """
    Tiny hand-rolled migration step for columns added to an *existing* table.

    `Base.metadata.create_all()` (called right before this in main.py's
    lifespan) only creates tables that don't exist yet - it never alters a
    table that's already there. That's fine for a brand-new table (like
    TelemetryImport), but Telemetry.import_id is a new column on a table
    that already has real rows on the deployed Postgres instance (and in any
    long-running local SQLite db), so it needs an explicit ALTER TABLE. No
    Alembic in this project yet (see models.py's module docstring) - this is
    a deliberately minimal stand-in for the handful of columns that need it,
    not a general migration framework. Safe to run on every boot: each ALTER
    only fires when its column is actually missing. cycle_number/capacity_ah
    are the same situation - added for CSV lab-cycling imports (see
    telemetry.py's import column-sniffing) after this table already had rows.
    """
    from sqlalchemy import inspect
    inspector = inspect(engine)
    if "telemetry" not in inspector.get_table_names():
        return  # fresh DB - create_all() above already created it with every column
    existing_cols = {c["name"] for c in inspector.get_columns("telemetry")}
    new_columns = {
        "import_id": "INTEGER",
        "cycle_number": "INTEGER",
        "capacity_ah": "FLOAT",
    }
    missing = {name: sql_type for name, sql_type in new_columns.items() if name not in existing_cols}
    if not missing:
        return
    with engine.begin() as conn:
        for name, sql_type in missing.items():
            conn.execute(text(f"ALTER TABLE telemetry ADD COLUMN {name} {sql_type}"))


def get_db():
    """FastAPI dependency — yields a DB session and guarantees it closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
