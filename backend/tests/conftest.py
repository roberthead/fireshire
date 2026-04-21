import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.database import get_db
from app.main import app


@pytest.fixture
async def _db_engine():
    """Per-test async engine with NullPool — avoids event-loop reuse across tests."""
    engine = create_async_engine(settings.database_url, poolclass=pool.NullPool)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def db_session(_db_engine):
    """Per-test AsyncSession, tied to the per-test engine."""
    maker = async_sessionmaker(_db_engine, expire_on_commit=False)
    async with maker() as session:
        yield session


@pytest.fixture
async def client(_db_engine):
    """HTTP client that routes get_db through the per-test engine."""
    maker = async_sessionmaker(_db_engine, expire_on_commit=False)

    async def _override_get_db():
        async with maker() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)
