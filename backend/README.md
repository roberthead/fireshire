# FireShire Backend

FastAPI backend for the fire-resilient landscaping zone visualizer.

## Prerequisites

- Python 3.12+
- [Poetry](https://python-poetry.org/)
- Docker Desktop (for PostgreSQL)

## Setup

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies
poetry install

# Run migrations
poetry run alembic upgrade head
```

## Development

```bash
# Start dev server (port 8000)
poetry run uvicorn app.main:app --reload

# Run tests
poetry run pytest -v

# Create a migration
poetry run alembic revision --autogenerate -m "description"
```

## Database

PostgreSQL runs via Docker Compose:

| Service | Port | Database |
|---------|------|----------|
| db | 5435 | fireshire |
| db-test | 5436 | fireshire_test |

Connection string: `postgresql+asyncpg://fireshire:fireshire@localhost:5435/fireshire`

## Configuration

Environment variables (prefix `FIRESHIRE_`):

| Variable | Default | Description |
|----------|---------|-------------|
| `FIRESHIRE_DATABASE_URL` | `postgresql+asyncpg://fireshire:fireshire@localhost:5435/fireshire` | Database connection string |
| `FIRESHIRE_MAPBOX_TOKEN` | (empty) | Mapbox public token |
