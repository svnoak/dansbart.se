"""Remove email column from users table for GDPR compliance.

Email is stored in Authentik (identity provider) and should not be duplicated
in our database to minimize PII exposure.

Revision ID: m8n9o0p1q2r3
Revises: l7m8n9o0p1q2
Create Date: 2026-01-21 08:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'm8n9o0p1q2r3'
down_revision = 'l7m8n9o0p1q2'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the email column and its index
    op.drop_index('ix_users_email', table_name='users')
    op.drop_column('users', 'email')


def downgrade():
    # Re-add email column (nullable since we don't have the data anymore)
    op.add_column('users', sa.Column('email', sa.String(), nullable=True))
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
