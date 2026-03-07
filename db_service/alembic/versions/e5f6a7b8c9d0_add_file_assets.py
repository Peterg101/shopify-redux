"""add file_assets table for S3-backed file storage

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-03-07 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        'file_assets',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.task_id'), nullable=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False),
        sa.Column('storage_backend', sa.String(), nullable=False, server_default='local'),
        sa.Column('storage_key', sa.String(), nullable=False),
        sa.Column('original_filename', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('content_type', sa.String(), nullable=True),
        sa.Column('processing_status', sa.String(), server_default='pending'),
        sa.Column('bounding_box_x', sa.Float(), nullable=True),
        sa.Column('bounding_box_y', sa.Float(), nullable=True),
        sa.Column('bounding_box_z', sa.Float(), nullable=True),
        sa.Column('volume_mm3', sa.Float(), nullable=True),
        sa.Column('surface_area_mm2', sa.Float(), nullable=True),
        sa.Column('preview_asset_id', sa.String(), sa.ForeignKey('file_assets.id'), nullable=True),
        sa.Column('thumbnail_asset_id', sa.String(), sa.ForeignKey('file_assets.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('file_assets')
