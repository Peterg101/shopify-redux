"""Add verified_examples table for feedback-driven example library.

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "verified_examples",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("task_id", sa.String(), nullable=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("keywords", sa.Text(), nullable=True),
        sa.Column("category", sa.String(), nullable=False, server_default="general"),
        sa.Column("complexity", sa.String(), nullable=False, server_default="simple"),
        sa.Column("source", sa.String(), nullable=False, server_default="user"),
        sa.Column("parameters", sa.Text(), nullable=True),
        sa.Column("steps", sa.Text(), nullable=True),
        sa.Column("cadquery_script", sa.Text(), nullable=True),
        sa.Column("generation_path", sa.String(), nullable=False, server_default="structured"),
        sa.Column("upvotes", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("downvotes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_curated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("geometry_hash", sa.String(), nullable=True),
        sa.Column("op_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.String(), nullable=True),
    )
    op.create_index("ix_verified_category_active", "verified_examples", ["category", "is_active"])
    op.create_index("ix_verified_geometry_hash", "verified_examples", ["geometry_hash"])
    op.create_index("ix_verified_category", "verified_examples", ["category"])


def downgrade():
    op.drop_index("ix_verified_category")
    op.drop_index("ix_verified_geometry_hash")
    op.drop_index("ix_verified_category_active")
    op.drop_table("verified_examples")
