from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Icarus"
    upload_dir: Path = Path("data/raw")
    processed_dir: Path = Path("data/processed")
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Vertex AI (preferred over AI Studio for image gen — billed through GCP).
    # When gcp_project_id is set, building_render calls Vertex; otherwise it
    # falls back to the AI Studio API key above.
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"

    # fal.ai — image-to-3D (Trellis/Hunyuan3D) for the building mesh.
    fal_api_key: str = ""

    # Reconstruction tools
    colmap_binary: str = "colmap"
    ffmpeg_binary: str = "ffmpeg"
    splat_training_iterations: int = 7000

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Building renders (Gemini img-to-img billboard)
    building_render_dir: Path = Path("data/processed")

    # Texture generation (Gemini 2.5 Flash Image — see services/generation/texture_generator.py)
    texture_dir: Path = Path("data/textures")
    texture_model_id: str = "gemini-2.5-flash-image"
    texture_size: int = 1024

    model_config = {"env_file": ".env"}


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.processed_dir.mkdir(parents=True, exist_ok=True)
settings.texture_dir.mkdir(parents=True, exist_ok=True)
