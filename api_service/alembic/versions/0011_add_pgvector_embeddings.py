"""Add embedding_json column to verified_examples for semantic retrieval.

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"


def upgrade():
    op.add_column("verified_examples", sa.Column("embedding_json", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("verified_examples", "embedding_json")
