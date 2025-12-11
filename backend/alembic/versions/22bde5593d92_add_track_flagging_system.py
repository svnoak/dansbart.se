"""add_track_flagging_system

Revision ID: 22bde5593d92
Revises: 267b6280082f
Create Date: 2025-12-11 07:13:50.310223

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '22bde5593d92'
down_revision: Union[str, Sequence[str], None] = '267b6280082f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add flagging system to tracks table."""
    # Add flagging columns to tracks table
    op.add_column('tracks', sa.Column('is_flagged', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('tracks', sa.Column('flagged_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tracks', sa.Column('flag_reason', sa.String(), nullable=True))

    # Add index for efficient querying of flagged tracks
    op.create_index('ix_tracks_is_flagged', 'tracks', ['is_flagged'])


def downgrade() -> None:
    """Remove flagging system from tracks table."""
    op.drop_index('ix_tracks_is_flagged', table_name='tracks')
    op.drop_column('tracks', 'flag_reason')
    op.drop_column('tracks', 'flagged_at')
    op.drop_column('tracks', 'is_flagged')
