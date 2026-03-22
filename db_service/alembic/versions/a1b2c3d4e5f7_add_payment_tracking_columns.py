"""add payment tracking columns to orders and disbursements

Revision ID: a1b2c3d4e5f7
Revises: f6a7b8c9d0e1
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f7'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('orders') as batch_op:
        batch_op.add_column(sa.Column('payment_intent', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('transfer_group', sa.String(), nullable=True))
        batch_op.create_index('ix_orders_payment_intent', ['payment_intent'])

    with op.batch_alter_table('disbursements') as batch_op:
        batch_op.add_column(sa.Column('source_transaction', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('transfer_group', sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table('disbursements') as batch_op:
        batch_op.drop_column('transfer_group')
        batch_op.drop_column('source_transaction')

    with op.batch_alter_table('orders') as batch_op:
        batch_op.drop_index('ix_orders_payment_intent')
        batch_op.drop_column('transfer_group')
        batch_op.drop_column('payment_intent')
