"""add_playlist_collaborators

Revision ID: l7m8n9o0p1q2
Revises: k6l7m8n9o0p1
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l7m8n9o0p1q2'
down_revision: Union[str, None] = 'k6l7m8n9o0p1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create playlist_collaborators table for user-based playlist sharing."""
    # Ensure uuid-ossp extension is enabled for uuid_generate_v4()
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    op.create_table(
        'playlist_collaborators',
        sa.Column('id', sa.UUID(), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('playlist_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(255), nullable=False),
        sa.Column('permission', sa.String(10), nullable=False),
        sa.Column('invited_by', sa.String(255), nullable=True),
        sa.Column('invited_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending', nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invited_by'], ['users.id'], ondelete='SET NULL'),
        sa.UniqueConstraint('playlist_id', 'user_id', name='unique_playlist_user_collaboration')
    )

    # Create indexes for efficient queries
    op.create_index('idx_playlist_collaborators_playlist', 'playlist_collaborators', ['playlist_id'])
    op.create_index('idx_playlist_collaborators_user', 'playlist_collaborators', ['user_id'])
    op.create_index('idx_playlist_collaborators_status', 'playlist_collaborators', ['status'])


def downgrade() -> None:
    """Drop playlist_collaborators table."""
    op.drop_index('idx_playlist_collaborators_status', table_name='playlist_collaborators')
    op.drop_index('idx_playlist_collaborators_user', table_name='playlist_collaborators')
    op.drop_index('idx_playlist_collaborators_playlist', table_name='playlist_collaborators')
    op.drop_table('playlist_collaborators')
