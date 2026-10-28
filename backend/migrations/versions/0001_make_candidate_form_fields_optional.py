"""Make candidate form fields optional

Revision ID: 0001_make_fields_optional
Revises: None
Create Date: 2026-10-28 10:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0001_make_fields_optional'
down_revision = None
branch_labels = None
depends_on = None

COLUMNS_TO_DROP_NOT_NULL = [
    'hero_category',
    'role_applied',
    'full_name',
    'mobile_number',
    'email',
    'aadhaar_number',
    'pan_number',
    'current_address_line1',
    'current_city',
    'current_state',
    'current_pincode',
    'current_country',
    'permanent_address_line1',
    'permanent_city',
    'permanent_state',
    'permanent_pincode',
    'permanent_country',
    'account_holder_name',
    'bank_name',
    'account_number',
    'ifsc_code',
    'circle',
    'district',
    'block',
    'current_salary',
    'asking_salary',
]


def upgrade():
    # Safely drop NOT NULL constraints on candidate form columns
    for col in COLUMNS_TO_DROP_NOT_NULL:
        op.execute(sa.text(f"ALTER TABLE candidate_applications ALTER COLUMN {col} DROP NOT NULL;"))


def downgrade():
    for col in COLUMNS_TO_DROP_NOT_NULL:
        op.execute(sa.text(f"ALTER TABLE candidate_applications ALTER COLUMN {col} SET NOT NULL;"))
