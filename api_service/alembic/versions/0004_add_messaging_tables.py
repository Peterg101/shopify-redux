"""add messaging tables (conversations, messages, read positions)

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('claim_id', sa.String(), sa.ForeignKey('claims.id'), nullable=False, unique=True),
        sa.Column('buyer_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('fulfiller_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'messages',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('conversation_id', sa.String(), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('sender_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_messages_conversation_created', 'messages', ['conversation_id', 'created_at'])

    op.create_table(
        'conversation_read_positions',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('conversation_id', sa.String(), sa.ForeignKey('conversations.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('last_read_message_id', sa.String(), sa.ForeignKey('messages.id'), nullable=True),
        sa.Column('last_read_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('conversation_id', 'user_id', name='uq_conversation_user_read'),
    )


def downgrade() -> None:
    op.drop_table('conversation_read_positions')
    op.drop_table('messages')
    op.drop_table('conversations')
