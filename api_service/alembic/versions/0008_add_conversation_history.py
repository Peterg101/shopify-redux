"""Add conversation_history column to tasks for persistent chat history.

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"


def upgrade():
    op.add_column("tasks", sa.Column("conversation_history", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("tasks", "conversation_history")
