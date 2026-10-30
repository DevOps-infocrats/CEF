"""Add site joining tracking columns to candidate applications

Revision ID: 0003_add_site_joining_columns
Revises: 0002_add_created_by_id
Create Date: 2026-10-30 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003_add_site_joining_columns'
down_revision = '0002_add_created_by_id'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'candidate_applications',
        sa.Column('site_joining_status', sa.String(length=50), nullable=False, server_default='NOT_JOINED')
    )
    op.add_column(
        'candidate_applications',
        sa.Column('site_joining_date', sa.String(length=50), nullable=True)
    )
    op.add_column(
        'candidate_applications',
        sa.Column('site_joining_updated_by_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column(
        'candidate_applications',
        sa.Column('site_joining_updated_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'candidate_applications',
        sa.Column('site_joining_notes', sa.String(length=500), nullable=True)
    )
    op.create_index(
        op.f('idx_candidate_site_joining'),
        'candidate_applications',
        ['site_joining_status'],
        unique=False
    )


def downgrade():
    op.drop_index(op.f('idx_candidate_site_joining'), table_name='candidate_applications')
    op.drop_column('candidate_applications', 'site_joining_notes')
    op.drop_column('candidate_applications', 'site_joining_updated_at')
    op.drop_column('candidate_applications', 'site_joining_updated_by_id')
    op.drop_column('candidate_applications', 'site_joining_date')
    op.drop_column('candidate_applications', 'site_joining_status')

