"""add shipping fields to orders claims and user_stripe_accounts

Revision ID: a1b2c3d4e5f6
Revises: 6dcc41a77631
Create Date: 2026-03-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6dcc41a77631'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # -- Orders: rename shopify_order_id -> stripe_checkout_session_id --
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("stripe_checkout_session_id", sa.String(), nullable=True))

    # -- Orders: buyer shipping address --
    with op.batch_alter_table("orders") as batch_op:
        batch_op.add_column(sa.Column("shipping_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipping_line1", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipping_line2", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipping_city", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipping_postal_code", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipping_country", sa.String(), nullable=True))

    # -- Claims: shipping/tracking info --
    with op.batch_alter_table("claims") as batch_op:
        batch_op.add_column(sa.Column("tracking_number", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("label_url", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("carrier_code", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("shipment_id", sa.String(), nullable=True))

    # -- UserStripeAccounts: fulfiller ship-from address --
    with op.batch_alter_table("user_stripe_accounts") as batch_op:
        batch_op.add_column(sa.Column("address_name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("address_line1", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("address_line2", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("address_city", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("address_postal_code", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("address_country", sa.String(), nullable=True))


def downgrade():
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("shipping_name")
        batch_op.drop_column("shipping_line1")
        batch_op.drop_column("shipping_line2")
        batch_op.drop_column("shipping_city")
        batch_op.drop_column("shipping_postal_code")
        batch_op.drop_column("shipping_country")

    with op.batch_alter_table("claims") as batch_op:
        batch_op.drop_column("tracking_number")
        batch_op.drop_column("label_url")
        batch_op.drop_column("carrier_code")
        batch_op.drop_column("shipment_id")

    with op.batch_alter_table("user_stripe_accounts") as batch_op:
        batch_op.drop_column("address_name")
        batch_op.drop_column("address_line1")
        batch_op.drop_column("address_line2")
        batch_op.drop_column("address_city")
        batch_op.drop_column("address_postal_code")
        batch_op.drop_column("address_country")
