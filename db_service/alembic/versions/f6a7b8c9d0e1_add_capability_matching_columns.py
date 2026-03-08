"""add capability matching columns to orders and basket_items

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-03-08
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    # Orders — manufacturing specification columns
    op.add_column('orders', sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=True))
    op.add_column('orders', sa.Column('material_id', sa.String(), sa.ForeignKey('manufacturing_materials.id'), nullable=True))
    op.add_column('orders', sa.Column('tolerance_mm', sa.Float(), nullable=True))
    op.add_column('orders', sa.Column('surface_finish', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('special_requirements', sa.Text(), nullable=True))

    # Basket items — manufacturing taxonomy links
    op.add_column('basket_items', sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=True))
    op.add_column('basket_items', sa.Column('material_id', sa.String(), sa.ForeignKey('manufacturing_materials.id'), nullable=True))


def downgrade():
    op.drop_column('basket_items', 'material_id')
    op.drop_column('basket_items', 'process_id')
    op.drop_column('orders', 'special_requirements')
    op.drop_column('orders', 'surface_finish')
    op.drop_column('orders', 'tolerance_mm')
    op.drop_column('orders', 'material_id')
    op.drop_column('orders', 'process_id')
