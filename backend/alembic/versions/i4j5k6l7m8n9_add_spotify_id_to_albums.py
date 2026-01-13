"""Add spotify_id to albums

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2026-01-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'i4j5k6l7m8n9'
down_revision: Union[str, Sequence[str], None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add spotify_id column to albums table
    op.add_column('albums', sa.Column('spotify_id', sa.String(), nullable=True))

    # Create unique index on spotify_id (only for non-null values)
    op.create_index(
        'ix_albums_spotify_id',
        'albums',
        ['spotify_id'],
        unique=True,
        postgresql_where=sa.text('spotify_id IS NOT NULL')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the index first
    op.drop_index('ix_albums_spotify_id', table_name='albums')

    # Drop the column
    op.drop_column('albums', 'spotify_id')
