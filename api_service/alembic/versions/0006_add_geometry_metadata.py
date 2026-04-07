"""Add geometry_metadata column to tasks table.

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"


def upgrade():
    op.add_column("tasks", sa.Column("geometry_metadata", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tasks", "geometry_metadata")
