"""order id foreign keyed

Revision ID: 8741dd308398
Revises: 9a6a79daa530
Create Date: 2026-01-15 09:26:20.172783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8741dd308398'
down_revision: Union[str, None] = '9a6a79daa530'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    with op.batch_alter_table("claims", recreate="always") as batch_op:
        batch_op.create_foreign_key(
            "fk_claims_order_id_orders",
            "orders",
            ["order_id"],
            ["order_id"]
        )

def downgrade():
    with op.batch_alter_table("claims", recreate="always") as batch_op:
        batch_op.drop_constraint(
            "fk_claims_order_id_orders",
            type_="foreignkey"
        )