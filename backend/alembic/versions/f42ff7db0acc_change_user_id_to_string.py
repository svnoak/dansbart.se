"""change_user_id_to_string

Revision ID: f42ff7db0acc
Revises: 905a494da80f
Create Date: 2026-01-04 16:56:53.797362

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f42ff7db0acc'
down_revision: Union[str, Sequence[str], None] = '905a494da80f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Drop foreign key constraints first
    op.drop_constraint('playlists_user_id_fkey', 'playlists', type_='foreignkey')
    op.drop_constraint('tracks_uploader_id_fkey', 'tracks', type_='foreignkey')

    # Convert user ID from UUID to String
    op.alter_column('users', 'id',
                    type_=sa.String(length=255),
                    postgresql_using='id::text')

    # Convert foreign key references
    op.alter_column('playlists', 'user_id',
                    type_=sa.String(length=255),
                    postgresql_using='user_id::text')

    op.alter_column('tracks', 'uploader_id',
                    type_=sa.String(length=255),
                    postgresql_using='uploader_id::text')

    # Re-add foreign key constraints
    op.create_foreign_key('playlists_user_id_fkey', 'playlists', 'users', ['user_id'], ['id'])
    op.create_foreign_key('tracks_uploader_id_fkey', 'tracks', 'users', ['uploader_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraints first
    op.drop_constraint('playlists_user_id_fkey', 'playlists', type_='foreignkey')
    op.drop_constraint('tracks_uploader_id_fkey', 'tracks', type_='foreignkey')

    # Convert back to UUID
    op.alter_column('playlists', 'user_id',
                    type_=postgresql.UUID(as_uuid=True),
                    postgresql_using='user_id::uuid')

    op.alter_column('tracks', 'uploader_id',
                    type_=postgresql.UUID(as_uuid=True),
                    postgresql_using='uploader_id::uuid')

    op.alter_column('users', 'id',
                    type_=postgresql.UUID(as_uuid=True),
                    postgresql_using='id::uuid')

    # Re-add foreign key constraints
    op.create_foreign_key('playlists_user_id_fkey', 'playlists', 'users', ['user_id'], ['id'])
    op.create_foreign_key('tracks_uploader_id_fkey', 'tracks', 'users', ['uploader_id'], ['id'], ondelete='SET NULL')
