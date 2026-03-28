"""add email verification + OAuth accounts

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email_verified to users
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('email_verified', sa.Boolean(), nullable=False, server_default='false'))

    # Create OAuth accounts table
    op.create_table('user_oauth_accounts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('provider', sa.String(), nullable=False),
        sa.Column('provider_user_id', sa.String(), nullable=False),
        sa.Column('provider_email', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('provider', 'provider_user_id', name='uq_provider_account'),
    )

    # Migrate existing Google users: set email_verified=True and create OAuth links
    op.execute("""
        UPDATE users SET email_verified = true WHERE auth_provider = 'google'
    """)
    op.execute("""
        INSERT INTO user_oauth_accounts (id, user_id, provider, provider_user_id, provider_email)
        SELECT gen_random_uuid()::text, user_id, 'google', user_id, email
        FROM users WHERE auth_provider = 'google'
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('user_oauth_accounts')
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('email_verified')
