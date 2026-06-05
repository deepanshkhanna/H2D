"""Database setup via SQLModel with Postgres env support and SQLite fallback."""

from pathlib import Path

from sqlmodel import SQLModel, create_engine, Session

from app.config import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        if settings.database_url:
            db_url = settings.database_url
            if db_url.startswith("postgresql://"):
                db_url = "postgresql+psycopg://" + db_url[len("postgresql://") :]
            elif db_url.startswith("postgres://"):
                db_url = "postgresql+psycopg://" + db_url[len("postgres://") :]
            _engine = create_engine(db_url)
        else:
            db_path = Path(settings.storage_root) / "opspilot.db"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            _engine = create_engine(
                f"sqlite:///{db_path}",
                connect_args={"check_same_thread": False},
            )
    return _engine


def create_tables():
    SQLModel.metadata.create_all(get_engine())


def get_session():
    with Session(get_engine()) as session:
        yield session
