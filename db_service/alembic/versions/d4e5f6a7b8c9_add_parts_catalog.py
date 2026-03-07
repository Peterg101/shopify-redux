"""add parts catalog table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-07 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        'parts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('publisher_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False, index=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.task_id'), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False),
        sa.Column('thumbnail_url', sa.String(), nullable=True),
        sa.Column('bounding_box_x', sa.Float(), nullable=True),
        sa.Column('bounding_box_y', sa.Float(), nullable=True),
        sa.Column('bounding_box_z', sa.Float(), nullable=True),
        sa.Column('volume_cm3', sa.Float(), nullable=True),
        sa.Column('surface_area_cm2', sa.Float(), nullable=True),
        sa.Column('recommended_process', sa.String(), nullable=True),
        sa.Column('recommended_material', sa.String(), nullable=True),
        sa.Column('status', sa.String(), default='draft'),
        sa.Column('is_public', sa.Boolean(), default=True),
        sa.Column('download_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('parts')
