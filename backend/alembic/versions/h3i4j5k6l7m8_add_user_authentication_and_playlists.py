"""Add user authentication and playlists

Revision ID: h3i4j5k6l7m8
Revises: b2c3d4e5f6a7, g2h3i4j5k6l7
Create Date: 2026-01-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, Sequence[str], None] = ('b2c3d4e5f6a7', 'g2h3i4j5k6l7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(), nullable=False, unique=True, index=True),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )

    # Create playlists table
    op.create_table(
        'playlists',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, default=False, server_default='false'),
        sa.Column('share_token', sa.String(), nullable=True, unique=True, index=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )

    # Create playlist_tracks junction table
    op.create_table(
        'playlist_tracks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('playlist_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('playlists.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('track_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tracks.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('position', sa.Integer(), nullable=False, default=0),
        sa.Column('added_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    )

    # Add unique constraint for playlist + track combination
    op.create_unique_constraint('uq_playlist_track', 'playlist_tracks', ['playlist_id', 'track_id'])

    # Add uploader_id to tracks table for Phase 2 (user uploads)
    op.add_column('tracks', sa.Column('uploader_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True))


def downgrade() -> None:
    # Remove uploader_id from tracks
    op.drop_column('tracks', 'uploader_id')

    # Drop tables in reverse order (FK constraints)
    op.drop_table('playlist_tracks')
    op.drop_table('playlists')
    op.drop_table('users')
