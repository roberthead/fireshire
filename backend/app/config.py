from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://fireshire:fireshire@localhost:5435/fireshire"
    mapbox_token: str = ""

    model_config = {"env_prefix": "FIRESHIRE_"}


settings = Settings()
