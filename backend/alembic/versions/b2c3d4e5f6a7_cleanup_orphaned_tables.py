"""Cleanup orphaned tables and columns from previous migrations

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f7
Create Date: 2025-12-26 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove orphaned tables and columns from previous migration attempts."""

    # Drop the migrated_to_recording_id column if it exists
    op.execute("ALTER TABLE tracks DROP COLUMN IF EXISTS migrated_to_recording_id")

    # Drop orphaned recording_* tables if they exist
    op.execute("DROP TABLE IF EXISTS recording_style_votes CASCADE")
    op.execute("DROP TABLE IF EXISTS recording_feel_votes CASCADE")
    op.execute("DROP TABLE IF EXISTS recording_structure_versions CASCADE")
    op.execute("DROP TABLE IF EXISTS recording_dance_styles CASCADE")
    op.execute("DROP TABLE IF EXISTS recording_artists CASCADE")
    op.execute("DROP TABLE IF EXISTS recordings CASCADE")

    # Drop the old album_tracks table if it exists (should be track_albums)
    op.execute("DROP TABLE IF EXISTS album_tracks CASCADE")

    # Drop any orphaned indexes
    op.execute("DROP INDEX IF EXISTS idx_tracks_migrated_recording")


def downgrade() -> None:
    """No downgrade - this is a cleanup migration."""
    pass
