"""add cadquery_script and generation_prompt to tasks

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tasks', sa.Column('cadquery_script', sa.Text(), nullable=True))
    op.add_column('tasks', sa.Column('generation_prompt', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('tasks', 'generation_prompt')
    op.drop_column('tasks', 'cadquery_script')
