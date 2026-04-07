import ssl as _ssl

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Neon requires SSL — strip sslmode param (asyncpg uses connect_args instead)
_db_url = settings.database_url.split("?")[0] if "?" in settings.database_url else settings.database_url
_connect_args: dict = {}
if "neon.tech" in settings.database_url or "sslmode" in settings.database_url:
    _ctx = _ssl.create_default_context()
    _ctx.check_hostname = False
    _ctx.verify_mode = _ssl.CERT_NONE
    _connect_args["ssl"] = _ctx

engine = create_async_engine(_db_url, connect_args=_connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session
