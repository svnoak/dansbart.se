"""Add analytics tracking

Revision ID: a1b2c3d4e5f6
Revises: 64f5af5ce616
Create Date: 2025-12-12 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '64f5af5ce616'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add duration tracking to track_playbacks
    op.add_column('track_playbacks', sa.Column('duration_seconds', sa.Integer(), nullable=True))
    op.add_column('track_playbacks', sa.Column('completed', sa.Boolean(), server_default='false', nullable=False))

    # Create visitor_sessions table
    op.create_table(
        'visitor_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', sa.String(), nullable=False, unique=True),
        sa.Column('first_seen', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_seen', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('user_agent', sa.String(), nullable=True),
        sa.Column('is_returning', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('page_views', sa.Integer(), server_default='1', nullable=False)
    )

    # Create indexes
    op.create_index('ix_visitor_sessions_session_id', 'visitor_sessions', ['session_id'])
    op.create_index('ix_visitor_sessions_first_seen', 'visitor_sessions', ['first_seen'])
    op.create_index('ix_visitor_sessions_last_seen', 'visitor_sessions', ['last_seen'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop visitor_sessions table
    op.drop_index('ix_visitor_sessions_last_seen', 'visitor_sessions')
    op.drop_index('ix_visitor_sessions_first_seen', 'visitor_sessions')
    op.drop_index('ix_visitor_sessions_session_id', 'visitor_sessions')
    op.drop_table('visitor_sessions')

    # Remove columns from track_playbacks
    op.drop_column('track_playbacks', 'completed')
    op.drop_column('track_playbacks', 'duration_seconds')
