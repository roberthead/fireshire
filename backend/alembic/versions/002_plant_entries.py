"""Create plant_entries table.

Revision ID: 002
Revises: 001
Create Date: 2026-04-20
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plant_entries",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("taxlot_id", sa.String(length=50), nullable=False),
        sa.Column("zone", sa.String(length=20), nullable=False),
        sa.Column("plant_id", sa.String(length=100), nullable=True),
        sa.Column("plant_name", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=20), server_default="manual", nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "zone IN ('0-5', '5-10', '10-30', '30-100')",
            name="ck_plant_entries_zone",
        ),
        sa.CheckConstraint(
            "source IN ('manual', 'photo_id')",
            name="ck_plant_entries_source",
        ),
    )
    op.create_index(
        "ix_plant_entries_taxlot_zone_live",
        "plant_entries",
        ["taxlot_id", "zone"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_plant_entries_taxlot_zone_live",
        table_name="plant_entries",
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.drop_table("plant_entries")
