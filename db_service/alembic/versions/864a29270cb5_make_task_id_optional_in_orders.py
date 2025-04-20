"""Make task_id optional in orders

Revision ID: 864a29270cb5
Revises: 4901d5317f29
Create Date: 2025-04-20 10:16:48.862774

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '864a29270cb5'
down_revision: Union[str, None] = '4901d5317f29'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # ### Step 1: Create a new table with task_id nullable
    op.create_table(
        'orders_tmp',
        sa.Column('order_id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('task_id', sa.String(), nullable=True),  # Made nullable here
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('material', sa.String(), nullable=False),
        sa.Column('technique', sa.String(), nullable=False),
        sa.Column('sizing', sa.Float(), nullable=False),
        sa.Column('colour', sa.String(), nullable=False),
        sa.Column('selectedFile', sa.String(), nullable=False),
        sa.Column('selectedFileType', sa.String(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('is_collaborative', sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
    )

    # ### Step 2: Copy the data
    op.execute("""
        INSERT INTO orders_tmp (
            order_id, user_id, task_id, name, material, technique, sizing,
            colour, selectedFile, selectedFileType, price, quantity,
            created_at, is_collaborative, status
        )
        SELECT
            order_id, user_id, task_id, name, material, technique, sizing,
            colour, selectedFile, selectedFileType, price, quantity,
            created_at, is_collaborative, status
        FROM orders
    """)

    # ### Step 3: Drop the old table
    op.drop_table('orders')

    # ### Step 4: Rename the new one
    op.rename_table('orders_tmp', 'orders')


def downgrade():
    raise NotImplementedError("Downgrade not supported for this migration.")
