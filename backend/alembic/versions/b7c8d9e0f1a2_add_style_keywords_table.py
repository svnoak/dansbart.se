"""Add style keywords table

Revision ID: b7c8d9e0f1a2
Revises: a1b2c3d4e5f6
Create Date: 2025-12-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Seed data: (keyword, main_style, sub_style)
# Merged from user requirements + existing KEYWORDS dict
SEED_KEYWORDS = [
    # HAMBO FAMILY
    ("hambo", "Hambo", None),
    ("hamburska", "Hambo", "Hamburska"),
    ("hambor", "Hambo", None),

    # POLSKA FAMILY
    ("polska", "Polska", None),
    ("bondpolska", "Polska", "Bondpolska"),
    ("bingsjöpolska", "Polska", "Bingsjö"),
    ("orsakorspolska", "Polska", "Orsa"),
    ("rättvikspolska", "Polska", "Rättvik"),
    ("bodapolska", "Polska", "Boda"),
    ("rörospols", "Polska", "Røros"),
    ("springlek", "Polska", "Springlek"),
    ("finnskogspols", "Polska", "Finnskog"),
    ("pols", "Polska", "Pols"),
    ("gammelpols", "Polska", None),
    ("hoppvals", "Polska", None),

    # SLÄNGPOLSKA FAMILY
    ("slängpolska", "Slängpolska", None),
    ("släng", "Slängpolska", None),

    # SCHOTTIS FAMILY
    ("schottis", "Schottis", None),
    ("rheinlender", "Schottis", "Reinländer"),
    ("reinländer", "Schottis", "Reinländer"),
    ("reinlender", "Schottis", "Reinländer"),

    # SNOA
    ("snoa", "Snoa", None),

    # GÅNGLÅT FAMILY
    ("gånglåt", "Gånglåt", None),
    ("marsch", "Gånglåt", "Marsch"),
    ("brudmarsch", "Gånglåt", "Marsch"),

    # POLKA FAMILY
    ("polka", "Polka", None),
    ("polkett", "Polka", None),

    # ENGELSKA FAMILY
    ("engelska", "Engelska", None),
    ("reel", "Engelska", None),
    ("anglais", "Engelska", None),

    # VALS FAMILY
    ("vals", "Vals", None),
    ("waltz", "Vals", None),
    ("brudvals", "Vals", None),
    ("walz", "Vals", None),
    ("stigvals", "Vals", "Stigvals"),

    # MAZURKA
    ("mazurka", "Mazurka", None),
    ("masurka", "Mazurka", None),

    # MENUETT
    ("menuett", "Menuett", None),
]


def upgrade() -> None:
    # 1. Create style_keywords table
    op.create_table(
        'style_keywords',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('keyword', sa.String(), nullable=False),
        sa.Column('main_style', sa.String(), nullable=False),
        sa.Column('sub_style', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('keyword', name='unique_keyword')
    )

    # Create indexes
    op.create_index('ix_style_keywords_keyword', 'style_keywords', ['keyword'])
    op.create_index('ix_style_keywords_main_style', 'style_keywords', ['main_style'])

    # 2. Add sub_style column to track_dance_styles
    op.add_column('track_dance_styles',
        sa.Column('sub_style', sa.String(), nullable=True)
    )
    op.create_index('ix_track_dance_styles_sub_style', 'track_dance_styles', ['sub_style'])

    # 3. Seed initial keywords
    style_keywords_table = sa.table(
        'style_keywords',
        sa.column('keyword', sa.String),
        sa.column('main_style', sa.String),
        sa.column('sub_style', sa.String),
    )

    op.bulk_insert(style_keywords_table, [
        {'keyword': kw, 'main_style': main, 'sub_style': sub}
        for kw, main, sub in SEED_KEYWORDS
    ])


def downgrade() -> None:
    # Remove sub_style from track_dance_styles
    op.drop_index('ix_track_dance_styles_sub_style', table_name='track_dance_styles')
    op.drop_column('track_dance_styles', 'sub_style')

    # Drop style_keywords table
    op.drop_index('ix_style_keywords_main_style', table_name='style_keywords')
    op.drop_index('ix_style_keywords_keyword', table_name='style_keywords')
    op.drop_table('style_keywords')
