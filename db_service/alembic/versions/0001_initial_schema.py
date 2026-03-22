"""initial schema — all tables from current models

Revision ID: 0001
Revises:
Create Date: 2026-03-22
"""
from alembic import op
import sqlalchemy as sa

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Reference tables (no FKs) ──

    op.create_table('users',
        sa.Column('user_id', sa.String(), primary_key=True),
        sa.Column('username', sa.String(), unique=True, nullable=False),
        sa.Column('email', sa.String(), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('auth_provider', sa.String(), nullable=False, server_default='google'),
    )
    op.create_index('ix_users_user_id', 'users', ['user_id'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])

    op.create_table('manufacturing_processes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('family', sa.String(), nullable=False),
        sa.Column('name', sa.String(), unique=True, nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
    )

    op.create_table('manufacturing_materials',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('name', sa.String(), unique=True, nullable=False),
        sa.Column('process_family', sa.String(), nullable=False),
    )

    # ── Tables with FK to users ──

    op.create_table('tasks',
        sa.Column('task_id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('task_name', sa.String(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False, server_default='obj'),
        sa.Column('complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.String(), nullable=False),
    )
    op.create_index('ix_tasks_task_id', 'tasks', ['task_id'])

    op.create_table('user_stripe_accounts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False, unique=True),
        sa.Column('stripe_account_id', sa.String(), nullable=False),
        sa.Column('account_type', sa.String(), nullable=False, server_default='express'),
        sa.Column('onboarding_complete', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('address_name', sa.String(), nullable=True),
        sa.Column('address_line1', sa.String(), nullable=True),
        sa.Column('address_line2', sa.String(), nullable=True),
        sa.Column('address_city', sa.String(), nullable=True),
        sa.Column('address_postal_code', sa.String(), nullable=True),
        sa.Column('address_country', sa.String(), nullable=True),
    )

    op.create_table('fulfiller_profiles',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False, unique=True),
        sa.Column('business_name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('max_build_volume_x', sa.Float(), nullable=True),
        sa.Column('max_build_volume_y', sa.Float(), nullable=True),
        sa.Column('max_build_volume_z', sa.Float(), nullable=True),
        sa.Column('min_tolerance_mm', sa.Float(), nullable=True),
        sa.Column('lead_time_days_min', sa.Integer(), nullable=True),
        sa.Column('lead_time_days_max', sa.Integer(), nullable=True),
        sa.Column('certifications', sa.Text(), nullable=True),
        sa.Column('post_processing', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── Tables with FK to tasks ──

    op.create_table('port_id',
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.task_id'), primary_key=True),
        sa.Column('port_id', sa.String(), nullable=False),
    )

    op.create_table('orders',
        sa.Column('order_id', sa.String(), primary_key=True),
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.task_id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('stripe_checkout_session_id', sa.String(), nullable=True),
        sa.Column('payment_intent', sa.String(), nullable=True),
        sa.Column('transfer_group', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('material', sa.String(), nullable=False),
        sa.Column('technique', sa.String(), nullable=False),
        sa.Column('sizing', sa.Float(), nullable=False),
        sa.Column('colour', sa.String(), nullable=False),
        sa.Column('selectedFile', sa.String(), nullable=False),
        sa.Column('selectedFileType', sa.String(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('is_collaborative', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
        sa.Column('qa_level', sa.String(), nullable=False, server_default='standard'),
        sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=True),
        sa.Column('material_id', sa.String(), sa.ForeignKey('manufacturing_materials.id'), nullable=True),
        sa.Column('tolerance_mm', sa.Float(), nullable=True),
        sa.Column('surface_finish', sa.String(), nullable=True),
        sa.Column('special_requirements', sa.Text(), nullable=True),
        sa.Column('shipping_name', sa.String(), nullable=True),
        sa.Column('shipping_line1', sa.String(), nullable=True),
        sa.Column('shipping_line2', sa.String(), nullable=True),
        sa.Column('shipping_city', sa.String(), nullable=True),
        sa.Column('shipping_postal_code', sa.String(), nullable=True),
        sa.Column('shipping_country', sa.String(), nullable=True),
    )
    op.create_index('ix_orders_stripe_checkout_session_id', 'orders', ['stripe_checkout_session_id'])
    op.create_index('ix_orders_payment_intent', 'orders', ['payment_intent'])

    op.create_table('parts',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('publisher_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
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
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('download_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_parts_name', 'parts', ['name'])

    op.create_table('file_assets',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.task_id'), nullable=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('file_type', sa.String(), nullable=False),
        sa.Column('storage_backend', sa.String(), nullable=False, server_default='local'),
        sa.Column('storage_key', sa.String(), nullable=False),
        sa.Column('original_filename', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('content_type', sa.String(), nullable=True),
        sa.Column('processing_status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('bounding_box_x', sa.Float(), nullable=True),
        sa.Column('bounding_box_y', sa.Float(), nullable=True),
        sa.Column('bounding_box_z', sa.Float(), nullable=True),
        sa.Column('volume_mm3', sa.Float(), nullable=True),
        sa.Column('surface_area_mm2', sa.Float(), nullable=True),
        sa.Column('preview_asset_id', sa.String(), sa.ForeignKey('file_assets.id'), nullable=True),
        sa.Column('thumbnail_asset_id', sa.String(), sa.ForeignKey('file_assets.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table('basket_items',
        sa.Column('task_id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('material', sa.String(), nullable=False),
        sa.Column('technique', sa.String(), nullable=False),
        sa.Column('sizing', sa.Float(), nullable=False),
        sa.Column('colour', sa.String(), nullable=False),
        sa.Column('selectedFile', sa.String(), nullable=False),
        sa.Column('selectedFileType', sa.String(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=True),
        sa.Column('material_id', sa.String(), sa.ForeignKey('manufacturing_materials.id'), nullable=True),
        sa.Column('tolerance_mm', sa.Float(), nullable=True),
        sa.Column('surface_finish', sa.String(), nullable=True),
        sa.Column('special_requirements', sa.Text(), nullable=True),
    )

    # ── Tables with FK to orders ──

    op.create_table('claims',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('order_id', sa.String(), sa.ForeignKey('orders.order_id'), nullable=False),
        sa.Column('claimant_user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('tracking_number', sa.String(), nullable=True),
        sa.Column('label_url', sa.String(), nullable=True),
        sa.Column('carrier_code', sa.String(), nullable=True),
        sa.Column('shipment_id', sa.String(), nullable=True),
        sa.UniqueConstraint('order_id', 'claimant_user_id', name='uq_order_user_claim'),
    )

    # ── Tables with FK to claims ──

    op.create_table('disbursements',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('claim_id', sa.String(), sa.ForeignKey('claims.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('stripe_transfer_id', sa.String(), nullable=True),
        sa.Column('source_transaction', sa.String(), nullable=True),
        sa.Column('transfer_group', sa.String(), nullable=True),
    )

    op.create_table('claim_evidence',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('claim_id', sa.String(), sa.ForeignKey('claims.id'), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status_at_upload', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
    )

    op.create_table('claim_status_history',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('claim_id', sa.String(), sa.ForeignKey('claims.id'), nullable=False),
        sa.Column('previous_status', sa.String(), nullable=False),
        sa.Column('new_status', sa.String(), nullable=False),
        sa.Column('changed_by', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table('disputes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('claim_id', sa.String(), sa.ForeignKey('claims.id'), nullable=False, unique=True),
        sa.Column('opened_by', sa.String(), sa.ForeignKey('users.user_id'), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='open'),
        sa.Column('resolution', sa.String(), nullable=True),
        sa.Column('resolution_amount_cents', sa.Integer(), nullable=True),
        sa.Column('resolved_by', sa.String(), nullable=True),
        sa.Column('fulfiller_response', sa.String(), nullable=True),
        sa.Column('responded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('fulfiller_deadline', sa.DateTime(timezone=True), nullable=False),
        sa.Column('buyer_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── Fulfiller capabilities (FK to profiles + processes) ──

    op.create_table('fulfiller_capabilities',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('profile_id', sa.String(), sa.ForeignKey('fulfiller_profiles.id'), nullable=False),
        sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=False),
        sa.Column('materials', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('fulfiller_capabilities')
    op.drop_table('disputes')
    op.drop_table('claim_status_history')
    op.drop_table('claim_evidence')
    op.drop_table('disbursements')
    op.drop_table('claims')
    op.drop_table('basket_items')
    op.drop_table('file_assets')
    op.drop_table('parts')
    op.drop_table('orders')
    op.drop_table('port_id')
    op.drop_table('fulfiller_profiles')
    op.drop_table('user_stripe_accounts')
    op.drop_table('tasks')
    op.drop_table('manufacturing_materials')
    op.drop_table('manufacturing_processes')
    op.drop_table('users')
