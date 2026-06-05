"""Application configuration loaded from .env."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = ""
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_service_role_key: str = ""
    opspilot_api_keys: str = ""
    environment: str = "development"
    max_upload_bytes: int = 15 * 1024 * 1024
    rate_limit_per_minute: int = 30
    enable_docling_parser: bool = False
    storage_root: str = "./data"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
