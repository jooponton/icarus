from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Icarus"
    upload_dir: Path = Path("data/raw")
    processed_dir: Path = Path("data/processed")
    anthropic_api_key: str = ""

    # Reconstruction tools
    colmap_binary: str = "colmap"
    ffmpeg_binary: str = "ffmpeg"
    splat_training_iterations: int = 7000

    # Texture generation
    texture_dir: Path = Path("data/textures")
    texture_model_id: str = "stabilityai/sdxl-turbo"
    texture_size: int = 512
    texture_inference_steps: int = 4
    texture_guidance_scale: float = 0.0

    model_config = {"env_file": ".env"}


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.processed_dir.mkdir(parents=True, exist_ok=True)
settings.texture_dir.mkdir(parents=True, exist_ok=True)
