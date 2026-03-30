"""add mobile refresh tokens table

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'mobile_refresh_tokens',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False, index=True),
        sa.Column('token_hash', sa.String(), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('mobile_refresh_tokens')
