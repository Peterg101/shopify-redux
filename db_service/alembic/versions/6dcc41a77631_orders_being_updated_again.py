"""orders being updated again

Revision ID: 6dcc41a77631
Revises: 8741dd308398
Create Date: 2026-01-15 14:02:28.640136

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6dcc41a77631'
down_revision: Union[str, None] = '8741dd308398'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    with op.batch_alter_table("claims") as batch_op:
        batch_op.create_unique_constraint(
            "uq_order_user_claim", ["order_id", "claimant_user_id"]
        )


def downgrade():
    with op.batch_alter_table("claims") as batch_op:
        batch_op.drop_constraint("uq_order_user_claim", type_="unique")