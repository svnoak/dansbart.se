"""Add pg_trgm extension and GIN indexes for fast text search.

This migration enables PostgreSQL's trigram extension (pg_trgm) which allows
GIN indexes to accelerate ILIKE queries with leading wildcards (e.g., '%search%').

Without these indexes, text searches perform full table scans. With trigram GIN
indexes, the same queries can use index scans, dramatically improving performance.

Revision ID: n9o0p1q2r3s4
Revises: m8n9o0p1q2r3
Create Date: 2026-01-31 12:00:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'n9o0p1q2r3s4'
down_revision = 'm8n9o0p1q2r3'
branch_labels = None
depends_on = None


def upgrade():
    # Enable the pg_trgm extension for trigram-based text search
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    # Create GIN indexes using trigram ops for fast ILIKE searches
    # These indexes support queries like: WHERE title ILIKE '%search%'
    # Note: Using regular CREATE INDEX (not CONCURRENTLY) since Alembic runs in a transaction

    # Track title - primary search field
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_tracks_title_trgm
        ON tracks USING gin (title gin_trgm_ops)
    ''')

    # Artist name - searched when looking for tracks by artist
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_artists_name_trgm
        ON artists USING gin (name gin_trgm_ops)
    ''')

    # Album title - searched when looking for tracks by album
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_albums_title_trgm
        ON albums USING gin (title gin_trgm_ops)
    ''')

    # Add composite index for playback_links to speed up YouTube availability check
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_playback_links_track_platform_working
        ON playback_links (track_id, platform, is_working)
        WHERE platform = 'youtube' AND is_working = true
    ''')

    # Add index on track_dance_styles for confidence filtering (commonly used)
    op.execute('''
        CREATE INDEX IF NOT EXISTS ix_track_dance_styles_confidence
        ON track_dance_styles (track_id, confidence)
        WHERE confidence >= 0.98
    ''')


def downgrade():
    op.execute('DROP INDEX IF EXISTS ix_track_dance_styles_confidence')
    op.execute('DROP INDEX IF EXISTS ix_playback_links_track_platform_working')
    op.execute('DROP INDEX IF EXISTS ix_albums_title_trgm')
    op.execute('DROP INDEX IF EXISTS ix_artists_name_trgm')
    op.execute('DROP INDEX IF EXISTS ix_tracks_title_trgm')
    # Note: We don't drop the pg_trgm extension as other things might depend on it
