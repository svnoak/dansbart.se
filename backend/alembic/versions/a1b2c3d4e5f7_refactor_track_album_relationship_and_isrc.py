"""Refactor Track-Album relationship to many-to-many and remove ISRC unique constraint

Revision ID: a1b2c3d4e5f7
Revises: f1e2d3c4b5a6
Create Date: 2025-12-26 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'f1e2d3c4b5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Refactor Track-Album relationship:
    1. Remove unique constraint from ISRC
    2. Create track_albums junction table
    3. Migrate existing album_id data to junction table
    4. Drop album_id column from tracks
    """

    # Step 1: Drop the unique constraint on ISRC if it exists
    # The constraint name might be 'tracks_isrc_key' (PostgreSQL auto-generated)
    op.execute("ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_isrc_key")

    # Step 2: Create the track_albums junction table
    op.create_table('track_albums',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('album_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['album_id'], ['albums.id'], ),
        sa.ForeignKeyConstraint(['track_id'], ['tracks.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('track_id', 'album_id', name='unique_track_album')
    )

    # Step 3: Migrate existing data from tracks.album_id to track_albums
    # Only migrate rows where album_id is not null
    op.execute("""
        INSERT INTO track_albums (id, track_id, album_id)
        SELECT gen_random_uuid(), id, album_id
        FROM tracks
        WHERE album_id IS NOT NULL
    """)

    # Step 4: Drop the old album_id foreign key constraint and column
    # First drop the foreign key constraint if it exists
    op.execute("ALTER TABLE tracks DROP CONSTRAINT IF EXISTS tracks_album_id_fkey")

    # Then drop the column
    op.drop_column('tracks', 'album_id')


def downgrade() -> None:
    """
    Revert the refactoring:
    1. Re-add album_id to tracks
    2. Migrate data back from junction table (taking first album for each track)
    3. Drop junction table
    4. Re-add unique constraint to ISRC
    """

    # Step 1: Re-add album_id column to tracks
    op.add_column('tracks',
        sa.Column('album_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Step 2: Re-add the foreign key constraint
    op.create_foreign_key('tracks_album_id_fkey', 'tracks', 'albums', ['album_id'], ['id'])

    # Step 3: Migrate data back from junction table (take the first album for each track)
    # This is lossy - if a track had multiple albums, only one will be kept
    op.execute("""
        UPDATE tracks
        SET album_id = ta.album_id
        FROM (
            SELECT DISTINCT ON (track_id) track_id, album_id
            FROM track_albums
            ORDER BY track_id
        ) ta
        WHERE tracks.id = ta.track_id
    """)

    # Step 4: Drop the junction table
    op.drop_table('track_albums')

    # Step 5: Re-add unique constraint to ISRC
    # Note: This might fail if there are now duplicate ISRCs in the database
    op.create_unique_constraint('tracks_isrc_key', 'tracks', ['isrc'])
