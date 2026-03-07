"""add manufacturing processes, materials, fulfiller profiles, and capabilities

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-07 12:00:00.000000

"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # -- ManufacturingProcess reference table --
    op.create_table(
        'manufacturing_processes',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('family', sa.String(), nullable=False),
        sa.Column('name', sa.String(), unique=True, nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
    )

    # -- ManufacturingMaterial reference table --
    op.create_table(
        'manufacturing_materials',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('name', sa.String(), unique=True, nullable=False),
        sa.Column('process_family', sa.String(), nullable=False),
    )

    # -- FulfillerProfile --
    op.create_table(
        'fulfiller_profiles',
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
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # -- FulfillerCapability (join: profile + process) --
    op.create_table(
        'fulfiller_capabilities',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('profile_id', sa.String(), sa.ForeignKey('fulfiller_profiles.id'), nullable=False),
        sa.Column('process_id', sa.String(), sa.ForeignKey('manufacturing_processes.id'), nullable=False),
        sa.Column('materials', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # -- Seed manufacturing processes --
    processes_table = sa.table(
        'manufacturing_processes',
        sa.column('id', sa.String),
        sa.column('family', sa.String),
        sa.column('name', sa.String),
        sa.column('display_name', sa.String),
    )
    processes = [
        # 3D Printing
        {'id': str(uuid4()), 'family': '3d_printing', 'name': 'FDM', 'display_name': 'Fused Deposition Modeling (FDM)'},
        {'id': str(uuid4()), 'family': '3d_printing', 'name': 'SLA', 'display_name': 'Stereolithography (SLA)'},
        {'id': str(uuid4()), 'family': '3d_printing', 'name': 'SLS', 'display_name': 'Selective Laser Sintering (SLS)'},
        {'id': str(uuid4()), 'family': '3d_printing', 'name': 'DMLS', 'display_name': 'Direct Metal Laser Sintering (DMLS)'},
        {'id': str(uuid4()), 'family': '3d_printing', 'name': 'MJF', 'display_name': 'Multi Jet Fusion (MJF)'},
        # CNC
        {'id': str(uuid4()), 'family': 'cnc', 'name': '3-axis CNC', 'display_name': '3-Axis CNC Milling'},
        {'id': str(uuid4()), 'family': 'cnc', 'name': '5-axis CNC', 'display_name': '5-Axis CNC Milling'},
        {'id': str(uuid4()), 'family': 'cnc', 'name': 'CNC Turning', 'display_name': 'CNC Turning / Lathe'},
        # Sheet Metal
        {'id': str(uuid4()), 'family': 'sheet_metal', 'name': 'Laser Cutting', 'display_name': 'Laser Cutting'},
        {'id': str(uuid4()), 'family': 'sheet_metal', 'name': 'Bending', 'display_name': 'Sheet Metal Bending'},
        {'id': str(uuid4()), 'family': 'sheet_metal', 'name': 'Stamping', 'display_name': 'Sheet Metal Stamping'},
        # Casting
        {'id': str(uuid4()), 'family': 'casting', 'name': 'Sand Casting', 'display_name': 'Sand Casting'},
        {'id': str(uuid4()), 'family': 'casting', 'name': 'Investment Casting', 'display_name': 'Investment Casting'},
        {'id': str(uuid4()), 'family': 'casting', 'name': 'Die Casting', 'display_name': 'Die Casting'},
        # Injection Molding
        {'id': str(uuid4()), 'family': 'injection_molding', 'name': 'Injection Molding', 'display_name': 'Plastic Injection Molding'},
    ]
    op.bulk_insert(processes_table, processes)

    # -- Seed manufacturing materials --
    materials_table = sa.table(
        'manufacturing_materials',
        sa.column('id', sa.String),
        sa.column('category', sa.String),
        sa.column('name', sa.String),
        sa.column('process_family', sa.String),
    )
    materials = [
        # Thermoplastics (3D printing)
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'PLA', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'ABS', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'PETG', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'Nylon (PA12)', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'TPU', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'ASA', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'thermoplastic', 'name': 'Polycarbonate', 'process_family': '3d_printing'},
        # Resins (3D printing)
        {'id': str(uuid4()), 'category': 'resin', 'name': 'Standard Resin', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'resin', 'name': 'Tough Resin', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'resin', 'name': 'Flexible Resin', 'process_family': '3d_printing'},
        {'id': str(uuid4()), 'category': 'resin', 'name': 'Castable Resin', 'process_family': '3d_printing'},
        # Metals (CNC, DMLS, Casting)
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Aluminum 6061', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Aluminum 7075', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Stainless Steel 304', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Stainless Steel 316', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Carbon Steel 1018', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Titanium Ti-6Al-4V', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Brass', 'process_family': 'cnc'},
        {'id': str(uuid4()), 'category': 'metal', 'name': 'Copper', 'process_family': 'cnc'},
        # Sheet Metal
        {'id': str(uuid4()), 'category': 'sheet_metal', 'name': 'Mild Steel Sheet', 'process_family': 'sheet_metal'},
        {'id': str(uuid4()), 'category': 'sheet_metal', 'name': 'Stainless Steel Sheet', 'process_family': 'sheet_metal'},
        {'id': str(uuid4()), 'category': 'sheet_metal', 'name': 'Aluminum Sheet', 'process_family': 'sheet_metal'},
        # Casting
        {'id': str(uuid4()), 'category': 'casting_material', 'name': 'Cast Aluminum', 'process_family': 'casting'},
        {'id': str(uuid4()), 'category': 'casting_material', 'name': 'Cast Iron', 'process_family': 'casting'},
        {'id': str(uuid4()), 'category': 'casting_material', 'name': 'Bronze', 'process_family': 'casting'},
        # Injection Molding
        {'id': str(uuid4()), 'category': 'injection_plastic', 'name': 'ABS (Injection)', 'process_family': 'injection_molding'},
        {'id': str(uuid4()), 'category': 'injection_plastic', 'name': 'Polypropylene', 'process_family': 'injection_molding'},
        {'id': str(uuid4()), 'category': 'injection_plastic', 'name': 'Nylon (Injection)', 'process_family': 'injection_molding'},
    ]
    op.bulk_insert(materials_table, materials)


def downgrade():
    op.drop_table('fulfiller_capabilities')
    op.drop_table('fulfiller_profiles')
    op.drop_table('manufacturing_materials')
    op.drop_table('manufacturing_processes')
