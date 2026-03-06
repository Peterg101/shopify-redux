"""add stripe_transfer_id to disbursements

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    with op.batch_alter_table("disbursements") as batch_op:
        batch_op.add_column(sa.Column("stripe_transfer_id", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("disbursements") as batch_op:
        batch_op.drop_column("stripe_transfer_id")
