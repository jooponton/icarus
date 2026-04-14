from __future__ import annotations

import asyncio
from functools import lru_cache

from supabase import AsyncClient, Client, acreate_client, create_client

from app.core.config import settings


def _require_credentials() -> tuple[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment"
        )
    return settings.supabase_url, settings.supabase_service_role_key


_async_client: AsyncClient | None = None
_async_lock = asyncio.Lock()


async def get_supabase() -> AsyncClient:
    global _async_client
    if _async_client is None:
        async with _async_lock:
            if _async_client is None:
                url, key = _require_credentials()
                _async_client = await acreate_client(url, key)
    return _async_client


@lru_cache(maxsize=1)
def get_supabase_sync() -> Client:
    url, key = _require_credentials()
    return create_client(url, key)
