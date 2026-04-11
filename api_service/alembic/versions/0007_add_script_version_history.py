"""Add task_script_versions table for undo/redo history.

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"


def upgrade():
    op.create_table(
        "task_script_versions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.task_id"), index=True, nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("cadquery_script", sa.Text(), nullable=False),
        sa.Column("generation_prompt", sa.Text(), nullable=True),
        sa.Column("geometry_metadata", sa.Text(), nullable=True),
        sa.Column("instruction", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_table("task_script_versions")
