"""Add billing tables: user_subscriptions, user_credits, credit_transactions.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_subscriptions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.user_id"), unique=True, nullable=False),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_subscription_id", sa.String(), nullable=True),
        sa.Column("tier", sa.String(), nullable=False, server_default="free"),
        sa.Column("status", sa.String(), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.String(), nullable=True),
        sa.Column("current_period_end", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=True),
    )

    op.create_table(
        "user_credits",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.user_id"), unique=True, nullable=False),
        sa.Column("available_credits", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("total_purchased", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rollover_credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("renewal_date", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=True),
    )

    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.user_id"), nullable=False),
        sa.Column("transaction_type", sa.String(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table("credit_transactions")
    op.drop_table("user_credits")
    op.drop_table("user_subscriptions")
