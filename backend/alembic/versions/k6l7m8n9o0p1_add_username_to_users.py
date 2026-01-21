"""add_username_to_users

Revision ID: k6l7m8n9o0p1
Revises: j5k6l7m8n9o0
Create Date: 2026-01-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k6l7m8n9o0p1'
down_revision: Union[str, None] = 'j5k6l7m8n9o0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add username field to users table and backfill with auto-generated usernames."""
    # Add column as nullable
    op.add_column('users', sa.Column('username', sa.String(50), nullable=True))

    # Backfill existing users with auto-generated usernames
    connection = op.get_bind()

    # Get all users
    result = connection.execute(sa.text("SELECT id FROM users WHERE username IS NULL"))
    users = result.fetchall()

    for user in users:
        # Generate username from first 8 characters of user ID
        user_id = user[0]
        generated_username = f"user_{user_id[:8]}"

        # Update user with generated username
        connection.execute(
            sa.text("UPDATE users SET username = :username WHERE id = :id"),
            {"username": generated_username, "id": user_id}
        )

    # Make column non-nullable
    op.alter_column('users', 'username', nullable=False)

    # Add unique index (case-insensitive)
    op.create_index(
        'idx_users_username_lower',
        'users',
        [sa.text('LOWER(username)')],
        unique=True
    )


def downgrade() -> None:
    """Remove username field from users table."""
    op.drop_index('idx_users_username_lower', table_name='users')
    op.drop_column('users', 'username')
