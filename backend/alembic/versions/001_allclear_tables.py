"""Create AllClear tables — parcels, user_progress, survey_responses, map_results.

Revision ID: 001
Revises: None
Create Date: 2026-04-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable trigram extension for fuzzy address search
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "parcels",
        sa.Column("hash_code", sa.String(16), primary_key=True),
        sa.Column("account", sa.String(32), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("owner_name", sa.Text),
        sa.Column("situs_address", sa.Text),
        sa.Column("mailing_address", sa.Text),
        sa.Column("acreage", sa.Float),
        sa.Column("year_built", sa.Integer),
        sa.Column("land_value", sa.Integer),
        sa.Column("imp_value", sa.Integer),
        sa.Column("prop_class", sa.String(16)),
        sa.Column("map_taxlot", sa.String(32)),
        sa.Column("subdivision", sa.Text),
        sa.Column("build_code", sa.Integer),
        sa.Column("comm_sqft", sa.Integer),
        sa.Column("lot_depth", sa.Integer),
        sa.Column("lot_width", sa.Integer),
        sa.Column("evac_zone", sa.String(32)),
        sa.Column("evac_city", sa.String(64)),
        sa.Column("city", sa.String(64)),
    )
    op.create_index("idx_parcels_account", "parcels", ["account"])
    op.create_index("idx_parcels_situs", "parcels", ["situs_address"])
    op.create_index(
        "idx_parcels_situs_trgm", "parcels", ["situs_address"],
        postgresql_using="gin", postgresql_ops={"situs_address": "gin_trgm_ops"},
    )

    op.create_table(
        "user_progress",
        sa.Column("hash_code", sa.String(16), sa.ForeignKey("parcels.hash_code"), primary_key=True),
        sa.Column("survey_complete", sa.Boolean, server_default="false", nullable=False),
        sa.Column("map_complete", sa.Boolean, server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "survey_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hash_code", sa.String(16), sa.ForeignKey("parcels.hash_code"), nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        # Contact
        sa.Column("respondent_name", sa.Text),
        sa.Column("respondent_email", sa.Text),
        sa.Column("respondent_phone", sa.Text),
        # Fire preparedness
        sa.Column("defensible_space", sa.String(16)),
        sa.Column("ember_resistant_roof", sa.String(16)),
        sa.Column("vegetation_clearance", sa.String(16)),
        sa.Column("has_fire_plan", sa.String(8)),
        sa.Column("has_go_bag", sa.String(16)),
        sa.Column("water_source", sa.Text),
        sa.Column("evacuation_route", sa.Text),
        sa.Column("hoa_name", sa.Text),
        # Interest in programs
        sa.Column("wants_assessment", sa.Boolean, server_default="false"),
        sa.Column("wants_firewise", sa.Boolean, server_default="false"),
        sa.Column("wants_newsletter", sa.Boolean, server_default="false"),
        # Open-ended
        sa.Column("concerns", sa.Text),
        sa.Column("notes", sa.Text),
    )
    op.create_index("idx_responses_hash", "survey_responses", ["hash_code"])

    op.create_table(
        "map_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("hash_code", sa.String(16), sa.ForeignKey("parcels.hash_code"), nullable=False),
        sa.Column("zones_geojson", JSONB),
        sa.Column("buildings_count", sa.Integer),
        sa.Column("plants_saved", JSONB),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_map_results_hash", "map_results", ["hash_code"])


def downgrade() -> None:
    op.drop_table("map_results")
    op.drop_table("survey_responses")
    op.drop_table("user_progress")
    op.drop_table("parcels")
    op.execute("DROP EXTENSION IF EXISTS pg_trgm")
