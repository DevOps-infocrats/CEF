"""Add created_by_id to candidate applications

Revision ID: 0002_add_created_by_id
Revises: 0001_make_fields_optional
Create Date: 2026-10-28 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0002_add_created_by_id'
down_revision = '0001_make_fields_optional'
branch_labels = None
depends_on = None


def upgrade():
    # Safely add created_by_id column referencing users.id
    op.add_column(
        'candidate_applications',
        sa.Column('created_by_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    )
    op.create_index(
        op.f('ix_candidate_applications_created_by_id'),
        'candidate_applications',
        ['created_by_id'],
        unique=False
    )


def downgrade():
    op.drop_index(op.f('ix_candidate_applications_created_by_id'), table_name='candidate_applications')
    op.drop_column('candidate_applications', 'created_by_id')

