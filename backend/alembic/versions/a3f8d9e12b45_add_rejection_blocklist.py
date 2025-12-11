"""add_rejection_blocklist

Revision ID: a3f8d9e12b45
Revises: 22bde5593d92
Create Date: 2025-12-11 20:53:53.600000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = 'a3f8d9e12b45'
down_revision: Union[str, Sequence[str], None] = '22bde5593d92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add rejection_logs table for blocklisting artists, albums, and tracks."""
    op.create_table(
        'rejection_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('spotify_id', sa.String(), nullable=False),
        sa.Column('entity_name', sa.String(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('rejected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('additional_data', JSONB, nullable=True),
        sa.UniqueConstraint('spotify_id', 'entity_type', name='unique_rejection')
    )

    # Add indexes for efficient querying
    op.create_index('ix_rejection_logs_entity_type', 'rejection_logs', ['entity_type'])
    op.create_index('ix_rejection_logs_spotify_id', 'rejection_logs', ['spotify_id'])


def downgrade() -> None:
    """Remove rejection_logs table."""
    op.drop_index('ix_rejection_logs_spotify_id', table_name='rejection_logs')
    op.drop_index('ix_rejection_logs_entity_type', table_name='rejection_logs')
    op.drop_table('rejection_logs')
