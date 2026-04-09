"""Seed Neon/Postgres with Ashland parcels from AllClear's SQLite database.

Usage:
    # Set FIRESHIRE_DATABASE_URL to your Neon connection string, then:
    python -m scripts.seed_parcels [path-to-fireready.db]

    # Defaults to: ../../AllClear/data/fireready.db
"""

import asyncio
import os
import sqlite3
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Default path assumes fireshire and AllClear repos are siblings
DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "AllClear", "data", "fireready.db"
)

PARCEL_COLUMNS = [
    "hash_code", "account", "role", "owner_name", "situs_address",
    "mailing_address", "acreage", "year_built", "land_value", "imp_value",
    "prop_class", "map_taxlot", "subdivision", "build_code", "comm_sqft",
    "lot_depth", "lot_width", "evac_zone", "evac_city", "city",
]

INSERT_SQL = text(f"""
    INSERT INTO parcels ({", ".join(PARCEL_COLUMNS)})
    VALUES ({", ".join(f":{c}" for c in PARCEL_COLUMNS)})
    ON CONFLICT (hash_code) DO UPDATE SET
        {", ".join(f"{c} = EXCLUDED.{c}" for c in PARCEL_COLUMNS if c != "hash_code")}
""")


async def seed(sqlite_path: str, database_url: str) -> None:
    # Read from SQLite
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.execute(
        f"SELECT {', '.join(PARCEL_COLUMNS)} FROM parcels WHERE city = 'ASHLAND' OR city IS NULL"
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    if not rows:
        print("No Ashland parcels found in SQLite database.")
        return

    print(f"Read {len(rows)} parcels from SQLite")

    # Strip sslmode from URL — asyncpg needs ssl passed via connect_args
    import ssl as ssl_mod
    clean_url = database_url.split("?")[0]
    needs_ssl = "sslmode" in database_url or "neon.tech" in database_url
    connect_args = {}
    if needs_ssl:
        ssl_ctx = ssl_mod.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl_mod.CERT_NONE
        connect_args["ssl"] = ssl_ctx

    # Write to Postgres/Neon
    engine = create_async_engine(clean_url, connect_args=connect_args)

    # Import models so Base.metadata is populated
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from app.database import Base
    import app.models  # noqa: F401

    # Step 1: Create tables via raw SQL (more reliable with Neon)
    async with engine.begin() as pg:
        await pg.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await pg.execute(text("""
            CREATE TABLE IF NOT EXISTS parcels (
                hash_code VARCHAR(16) PRIMARY KEY,
                account VARCHAR(32) NOT NULL,
                role VARCHAR(16) NOT NULL,
                owner_name TEXT,
                situs_address TEXT,
                mailing_address TEXT,
                acreage DOUBLE PRECISION,
                year_built INTEGER,
                land_value INTEGER,
                imp_value INTEGER,
                prop_class VARCHAR(16),
                map_taxlot VARCHAR(32),
                subdivision TEXT,
                build_code INTEGER,
                comm_sqft INTEGER,
                lot_depth INTEGER,
                lot_width INTEGER,
                evac_zone VARCHAR(32),
                evac_city VARCHAR(64),
                city VARCHAR(64)
            )
        """))
        await pg.execute(text("CREATE INDEX IF NOT EXISTS idx_parcels_account ON parcels(account)"))
        await pg.execute(text("CREATE INDEX IF NOT EXISTS idx_parcels_situs ON parcels(situs_address)"))
        await pg.execute(text("""
            CREATE TABLE IF NOT EXISTS user_progress (
                hash_code VARCHAR(16) PRIMARY KEY REFERENCES parcels(hash_code),
                survey_complete BOOLEAN NOT NULL DEFAULT false,
                map_complete BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        await pg.execute(text("""
            CREATE TABLE IF NOT EXISTS survey_responses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hash_code VARCHAR(16) NOT NULL REFERENCES parcels(hash_code),
                responded_at TIMESTAMPTZ DEFAULT now(),
                respondent_name TEXT, respondent_email TEXT, respondent_phone TEXT,
                defensible_space VARCHAR(16), ember_resistant_roof VARCHAR(16),
                vegetation_clearance VARCHAR(16), has_fire_plan VARCHAR(8),
                has_go_bag VARCHAR(16), water_source TEXT, evacuation_route TEXT,
                hoa_name TEXT, wants_assessment BOOLEAN DEFAULT false,
                wants_firewise BOOLEAN DEFAULT false, wants_newsletter BOOLEAN DEFAULT false,
                concerns TEXT, notes TEXT
            )
        """))
        await pg.execute(text("""
            CREATE TABLE IF NOT EXISTS map_results (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                hash_code VARCHAR(16) NOT NULL REFERENCES parcels(hash_code),
                zones_geojson JSONB, buildings_count INTEGER,
                plants_saved JSONB, completed_at TIMESTAMPTZ DEFAULT now()
            )
        """))
    print("Tables created")

    # Verify table exists
    async with engine.connect() as pg:
        result = await pg.execute(text("SELECT COUNT(*) FROM parcels"))
        count = result.scalar()
        print(f"  Verified: parcels table has {count} rows")

    # Step 2: Insert data
    async with engine.begin() as pg:
        batch_size = 500
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            await pg.execute(INSERT_SQL, batch)
            print(f"  Inserted {min(i + batch_size, len(rows))}/{len(rows)}")

    await engine.dispose()
    print(f"Done — seeded {len(rows)} Ashland parcels into Postgres")


def main():
    sqlite_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SQLITE_PATH
    sqlite_path = os.path.abspath(sqlite_path)

    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite database not found at {sqlite_path}")
        print("Usage: python -m scripts.seed_parcels [path-to-fireready.db]")
        sys.exit(1)

    database_url = os.environ.get("FIRESHIRE_DATABASE_URL")
    if not database_url:
        print("Error: FIRESHIRE_DATABASE_URL environment variable not set")
        print("Set it to your Neon connection string, e.g.:")
        print("  export FIRESHIRE_DATABASE_URL=postgresql+asyncpg://user:pass@ep-xxx.neon.tech/fireshire")
        sys.exit(1)

    print(f"Source: {sqlite_path}")
    print(f"Target: {database_url.split('@')[1] if '@' in database_url else '(configured)'}")

    asyncio.run(seed(sqlite_path, database_url))


if __name__ == "__main__":
    main()
