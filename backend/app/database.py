"""SQLite database setup via SQLModel."""

from pathlib import Path

from sqlmodel import SQLModel, create_engine, Session

from app.config import settings

_engine = None


def get_engine():
    global _engine
    if _engine is None:
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
