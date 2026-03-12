"""add capability matching columns to orders and basket_items

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d1
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d1'
branch_labels = None
depends_on = None


def upgrade():
    # Orders — manufacturing specification columns
    # Use batch mode for SQLite compatibility (no ALTER ADD CONSTRAINT support)
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('process_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('material_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('tolerance_mm', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('surface_finish', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('special_requirements', sa.Text(), nullable=True))

    # Basket items — manufacturing taxonomy links
    with op.batch_alter_table('basket_items') as batch_op:
        batch_op.add_column(sa.Column('process_id', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('material_id', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('basket_items') as batch_op:
        batch_op.drop_column('material_id')
        batch_op.drop_column('process_id')

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_column('special_requirements')
        batch_op.drop_column('surface_finish')
        batch_op.drop_column('tolerance_mm')
        batch_op.drop_column('material_id')
        batch_op.drop_column('process_id')
