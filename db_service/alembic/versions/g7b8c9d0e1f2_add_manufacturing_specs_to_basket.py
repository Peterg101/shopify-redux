"""add tolerance, surface_finish, special_requirements to basket_items

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-03-12
"""
from alembic import op
import sqlalchemy as sa

revision = 'g7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('basket_items') as batch_op:
        batch_op.add_column(sa.Column('tolerance_mm', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('surface_finish', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('special_requirements', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('basket_items') as batch_op:
        batch_op.drop_column('special_requirements')
        batch_op.drop_column('surface_finish')
        batch_op.drop_column('tolerance_mm')
