from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Icarus"
    upload_dir: Path = Path("data/raw")
    processed_dir: Path = Path("data/processed")
    anthropic_api_key: str = ""

    model_config = {"env_file": ".env"}


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.processed_dir.mkdir(parents=True, exist_ok=True)
