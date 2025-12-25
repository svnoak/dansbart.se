"""Add deleted_content flag to rejection_log

Revision ID: f1e2d3c4b5a6
Revises: e5f6a7b8c9d0
Create Date: 2025-12-25 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1e2d3c4b5a6'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add deleted_content column to rejection_logs table."""
    # Add the deleted_content column with default value True (existing rejections had content deleted)
    op.add_column('rejection_logs',
        sa.Column('deleted_content', sa.Boolean(), nullable=False, server_default='true')
    )


def downgrade() -> None:
    """Remove deleted_content column from rejection_logs table."""
    op.drop_column('rejection_logs', 'deleted_content')
