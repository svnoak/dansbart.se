"""Add user authentication and playlists

Revision ID: a1b2c3d4e5f6
Revises: f73663c88208
Create Date: 2026-01-02 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f73663c88208'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add user authentication and playlist tables."""

    # Create users table (minimal - Authentik stores full user data)
    op.create_table('users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)

    # Create playlists table
    op.create_table('playlists',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('cover_image_url', sa.String(), nullable=True),
        sa.Column('is_public', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('share_token', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('share_token')
    )
    op.create_index(op.f('ix_playlists_user_id'), 'playlists', ['user_id'], unique=False)
    op.create_index(op.f('ix_playlists_share_token'), 'playlists', ['share_token'], unique=False)

    # Create playlist_tracks junction table
    op.create_table('playlist_tracks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('playlist_id', sa.UUID(), nullable=False),
        sa.Column('track_id', sa.UUID(), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['playlist_id'], ['playlists.id'], ),
        sa.ForeignKeyConstraint(['track_id'], ['tracks.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('playlist_id', 'track_id', name='unique_playlist_track')
    )
    op.create_index(op.f('ix_playlist_tracks_playlist_id'), 'playlist_tracks', ['playlist_id'], unique=False)
    op.create_index(op.f('ix_playlist_tracks_track_id'), 'playlist_tracks', ['track_id'], unique=False)

    # Add uploader_id to tracks table (Phase 2 preparation - nullable for existing tracks)
    op.add_column('tracks', sa.Column('uploader_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_tracks_uploader_id', 'tracks', 'users', ['uploader_id'], ['id'])
    op.create_index(op.f('ix_tracks_uploader_id'), 'tracks', ['uploader_id'], unique=False)


def downgrade() -> None:
    """Remove user authentication and playlist tables."""

    # Remove uploader_id from tracks
    op.drop_index(op.f('ix_tracks_uploader_id'), table_name='tracks')
    op.drop_constraint('fk_tracks_uploader_id', 'tracks', type_='foreignkey')
    op.drop_column('tracks', 'uploader_id')

    # Drop playlist_tracks
    op.drop_index(op.f('ix_playlist_tracks_track_id'), table_name='playlist_tracks')
    op.drop_index(op.f('ix_playlist_tracks_playlist_id'), table_name='playlist_tracks')
    op.drop_table('playlist_tracks')

    # Drop playlists
    op.drop_index(op.f('ix_playlists_share_token'), table_name='playlists')
    op.drop_index(op.f('ix_playlists_user_id'), table_name='playlists')
    op.drop_table('playlists')

    # Drop users
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
