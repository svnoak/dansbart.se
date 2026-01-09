"""Add CASCADE delete to track relationships

Revision ID: g2h3i4j5k6l7
Revises: f1e2d3c4b5a6
Create Date: 2026-01-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, Sequence[str], None] = 'f1e2d3c4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add CASCADE delete to foreign key constraints on track_id columns."""

    # List of tables and their foreign key constraint names that reference tracks.id
    # We need to drop the old constraint and recreate it with ON DELETE CASCADE

    tables_to_update = [
        ('analysis_sources', 'analysis_sources_track_id_fkey'),
        ('track_dance_styles', 'track_dance_styles_track_id_fkey'),
        ('playback_links', 'playback_links_track_id_fkey'),
        ('track_style_votes', 'track_style_votes_track_id_fkey'),
        ('track_structure_versions', 'track_structure_versions_track_id_fkey'),
        ('track_feel_votes', 'track_feel_votes_track_id_fkey'),
    ]

    for table_name, constraint_name in tables_to_update:
        # Drop existing foreign key constraint
        op.drop_constraint(constraint_name, table_name, type_='foreignkey')

        # Recreate with CASCADE delete
        op.create_foreign_key(
            constraint_name,
            table_name,
            'tracks',
            ['track_id'],
            ['id'],
            ondelete='CASCADE'
        )


def downgrade() -> None:
    """Remove CASCADE delete from foreign key constraints."""

    tables_to_update = [
        ('analysis_sources', 'analysis_sources_track_id_fkey'),
        ('track_dance_styles', 'track_dance_styles_track_id_fkey'),
        ('playback_links', 'playback_links_track_id_fkey'),
        ('track_style_votes', 'track_style_votes_track_id_fkey'),
        ('track_structure_versions', 'track_structure_versions_track_id_fkey'),
        ('track_feel_votes', 'track_feel_votes_track_id_fkey'),
    ]

    for table_name, constraint_name in tables_to_update:
        # Drop CASCADE constraint
        op.drop_constraint(constraint_name, table_name, type_='foreignkey')

        # Recreate without CASCADE
        op.create_foreign_key(
            constraint_name,
            table_name,
            'tracks',
            ['track_id'],
            ['id']
        )
