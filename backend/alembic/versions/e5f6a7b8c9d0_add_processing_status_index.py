"""Add processing_status index for better query performance

Revision ID: e5f6a7b8c9d0
Revises: c7a64fa45998
Create Date: 2025-12-25 13:34:56.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'c7a64fa45998'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add index on processing_status for better performance on cleanup and status queries
    op.create_index('idx_tracks_processing_status', 'tracks', ['processing_status'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove the index
    op.drop_index('idx_tracks_processing_status', table_name='tracks')
