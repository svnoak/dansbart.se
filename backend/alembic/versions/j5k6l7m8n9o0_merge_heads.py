"""Merge heads

Revision ID: j5k6l7m8n9o0
Revises: f42ff7db0acc, i4j5k6l7m8n9
Create Date: 2026-01-12 15:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j5k6l7m8n9o0'
down_revision: Union[str, Sequence[str], None] = ('f42ff7db0acc', 'i4j5k6l7m8n9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge heads - no schema changes needed."""
    pass


def downgrade() -> None:
    """Merge heads - no schema changes needed."""
    pass
