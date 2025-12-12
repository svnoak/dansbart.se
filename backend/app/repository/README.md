# Repository Pattern Implementation

This directory contains the repository layer for the dansbart.se backend, providing optimized database access patterns and query optimization.

## 📋 Overview

The repository pattern separates data access logic from business logic, providing:
- **Centralized query optimization** - All queries for an entity in one place
- **Batch operations** - Optimized bulk queries to reduce N+1 problems
- **Eager loading strategies** - Predefined loading patterns to minimize database roundtrips
- **Reusable patterns** - Common CRUD operations inherited from `BaseRepository`
- **Better testability** - Easy to mock repositories for unit tests

## 🗂️ Repository Structure

```
backend/app/repository/
├── base.py              # BaseRepository - Generic CRUD, pagination, filtering
├── artist.py            # ArtistRepository - Artist queries & isolation detection
├── album.py             # AlbumRepository - Album queries & orphan cleanup
├── track.py             # TrackRepository - Track queries & cascade deletes
├── rejection.py         # RejectionRepository - Blocklist management
├── analysis.py          # AnalysisRepository - Analysis data management
└── README.md            # This file
```

## 🔧 BaseRepository

The `BaseRepository` class provides common operations for all entities:

### Basic CRUD
```python
# Get by ID
entity = repo.get_by_id(entity_id, eager_load=[...])

# Create
new_entity = repo.create(name="Example", ...)

# Update
repo.update(entity, field="new_value")

# Delete
repo.delete(entity)
repo.delete_by_id(entity_id)
```

### Pagination
```python
items, total = repo.paginate(
    limit=50,
    offset=0,
    filters={'status': 'active'},
    search="search term",
    search_fields=['name', 'title'],
    order_by=Model.created_at.desc(),
    eager_load=[joinedload(Model.related)]
)

# Build response
response = repo.build_paginated_response(items, total, limit, offset)
```

### Batch Operations
```python
# Bulk create
entities = repo.bulk_create([{...}, {...}, {...}])

# Bulk delete
deleted_count = repo.bulk_delete([id1, id2, id3])
```

### Filtering & Search
```python
# Find one
entity = repo.find_one({'name': 'Example'}, eager_load=[...])

# Find all with filters
entities = repo.find_all(
    filters={'status': 'active'},
    order_by=Model.name,
    limit=100
)

# Check existence
exists = repo.exists(name='Example')

# Count
count = repo.count({'status': 'active'})
```

## 📦 Specific Repositories

### ArtistRepository

**Key Features:**
- Batch track statistics aggregation
- Isolation detection (finds artists who collaborate vs solo artists)
- Verified artist management

```python
from app.repository.artist import ArtistRepository

artist_repo = ArtistRepository(db)

# Get or create artist
artist = artist_repo.get_or_create(
    name="Artist Name",
    spotify_id="spotify_id",
    image_url="https://..."
)

# Get track statistics (batch optimized)
artist_ids = [uuid1, uuid2, uuid3]
stats_map = artist_repo.get_track_stats_batch(artist_ids)
# Returns: {'artist_id': {'total': 10, 'done': 8, 'pending': 2, 'failed': 0}}

# Get isolation info (optimized SQL aggregation)
isolation = artist_repo.get_isolation_info(artist_id)
# Returns: {
#     'is_isolated': False,
#     'shared_with_artists': ['Artist A', 'Artist B'],
#     'shared_tracks': 5,
#     'shared_albums': 2,
#     'total_tracks': 10
# }

# Get paginated artists with stats
items, total = artist_repo.get_artists_with_stats(
    search="folk",
    verified_only=True,
    limit=50,
    offset=0
)

# Verify artists
artist_repo.verify_artist(artist_id)
artist_repo.bulk_verify([uuid1, uuid2, uuid3])
```

### AlbumRepository

**Key Features:**
- Track statistics aggregation
- All contributing artists (not just primary artist)
- Orphan album detection and cleanup

```python
from app.repository.album import AlbumRepository

album_repo = AlbumRepository(db)

# Get or create album
album = album_repo.get_or_create(
    title="Album Title",
    artist_id=primary_artist_id,
    cover_url="https://...",
    release_date="2024-01-01"
)

# Get all artists on album (collaborations)
artists = album_repo.get_all_artists_on_album(album_id)

# Batch operation
album_ids = [uuid1, uuid2, uuid3]
artists_map = album_repo.get_all_artists_on_albums_batch(album_ids)
# Returns: {'album_id': ['Artist A', 'Artist B', 'Artist C']}

# Find and delete orphan albums (no tracks)
orphans = album_repo.find_orphan_albums(limit=100)
result = album_repo.delete_orphan_albums(dry_run=False)
```

### TrackRepository

**Key Features:**
- Track creation with artist/album relationships
- Playback link management
- Dance style management
- Cascade delete operations
- Track statistics by entity (artist or album)

```python
from app.repository.track import TrackRepository

track_repo = TrackRepository(db)

# Create track with relationships
track = track_repo.create_track(
    title="Track Title",
    isrc="ISRC123",
    duration_ms=180000,
    album_data={'name': 'Album', 'cover': 'url', 'date': '2024'},
    artists_data=[{'name': 'Artist', 'id': 'spotify_id'}]
)

# Manage playback links
track_repo.add_playback_link(track_id, 'youtube', 'https://...')
links = track_repo.get_playback_links(track_id)

# Manage dance styles
track_repo.add_dance_style(track_id, 'Hambo', 1.0, 120)
styles = track_repo.get_dance_styles(track_id)

# Get track stats by entity (batch optimized)
stats_map = track_repo.get_track_stats_by_entity(
    entity_type='artist',  # or 'album'
    entity_ids=[uuid1, uuid2, uuid3]
)

# Cascade delete (removes all related data)
counts = track_repo.delete_with_cascade([track_id1, track_id2])
# Returns: {
#     'track_artists': 3,
#     'playback_links': 2,
#     'dance_styles': 1,
#     'analysis_sources': 1,
#     'tracks': 2
# }

# Update status
track_repo.update_status(track_id, 'DONE')
track_repo.bulk_update_status([uuid1, uuid2], 'PENDING')
```

### RejectionRepository

**Key Features:**
- Blocklist management
- Batch blocklist checking
- Entity type filtering

```python
from app.repository.rejection import RejectionRepository

rejection_repo = RejectionRepository(db)

# Add to blocklist
rejection = rejection_repo.add_to_blocklist(
    entity_type='artist',
    spotify_id='spotify_id',
    name='Artist Name',
    reason='Not folk music',
    additional_data={'genre': 'pop'}
)

# Check if blocked
is_blocked = rejection_repo.is_blocked('spotify_id', 'artist')

# Batch check (optimized)
spotify_ids = ['id1', 'id2', 'id3']
blocked_map = rejection_repo.check_multiple_blocked(spotify_ids, 'artist')
# Returns: {'id1': True, 'id2': False, 'id3': True}

# Search rejections
items, total = rejection_repo.search_rejections(
    search_term='artist name',
    entity_type='artist',
    limit=50,
    offset=0
)

# Remove from blocklist
entity_name = rejection_repo.remove_from_blocklist(rejection_id)
```

### AnalysisRepository

**Key Features:**
- Analysis source management
- Genre profile management
- Latest analysis retrieval

```python
from app.repository.analysis import AnalysisRepository

analysis_repo = AnalysisRepository(db)

# Add analysis
analysis = analysis_repo.add_analysis(
    track_id=track_id,
    source_type='spotify',
    raw_data={'tempo': 120, 'key': 'C'},
    confidence_score=0.95
)

# Get latest analysis
latest = analysis_repo.get_latest_by_track(track_id, source_type='spotify')

# Genre profiles
profile = analysis_repo.save_genre_profile(
    genre_name='traditional_folk',
    avg_note_density=0.8,
    common_meters={'4/4': 0.7, '3/4': 0.3},
    rhythm_patterns={...},
    sample_size=100
)

profile = analysis_repo.get_genre_profile('traditional_folk')
```

## ⚡ Query Optimization Strategies

### 1. Eager Loading

Repositories define eager loading strategies to prevent N+1 queries:

```python
# Basic loading
eager_load_basic = TrackRepository.get_eager_load_basic()
# Loads: dance_styles, artist_links.artist, album

# Full loading
eager_load_full = TrackRepository.get_eager_load_full()
# Loads: everything including analysis_sources, playback_links
```

**Usage:**
```python
track = track_repo.get_by_id(track_id, eager_load=track_repo.get_eager_load_full())
```

### 2. Batch Operations

Always use batch methods when working with multiple entities:

```python
# ❌ BAD: N+1 queries
for artist_id in artist_ids:
    stats = artist_repo.get_track_stats(artist_id)  # 1 query per artist

# ✅ GOOD: Single query
stats_map = artist_repo.get_track_stats_batch(artist_ids)  # 1 query total
```

### 3. Selectinload vs Joinedload

- **`joinedload`**: Use for single relationships (one-to-one, many-to-one)
  ```python
  joinedload(Track.album)  # Single album per track
  ```

- **`selectinload`**: Use for collections (one-to-many, many-to-many)
  ```python
  selectinload(Track.dance_styles)  # Multiple styles per track
  ```

### 4. Subquery Optimization

Complex aggregations use subqueries to avoid loading data into memory:

```python
# Isolation detection uses subqueries
isolation_info = artist_repo.get_isolation_info(artist_id)
# No tracks loaded into Python - pure SQL aggregation
```

## 🔄 Migration Guide

### Before (Direct DB Queries in Service)
```python
class AdminArtistService:
    def get_artists(self, search=None):
        query = self.db.query(Artist)
        if search:
            query = query.filter(Artist.name.ilike(f"%{search}%"))
        artists = query.all()

        # Get stats one by one (N+1 problem)
        for artist in artists:
            stats = self.db.query(...).filter(...).first()
```

### After (Using Repository)
```python
class AdminArtistService:
    def __init__(self, db: Session):
        self.artist_repo = ArtistRepository(db)

    def get_artists(self, search=None):
        # Optimized with batch loading
        items, total = self.artist_repo.get_artists_with_stats(
            search=search,
            limit=50,
            offset=0
        )
```

## 🧪 Testing with Repositories

Repositories make testing easier:

```python
from unittest.mock import Mock

def test_artist_service():
    # Mock repository
    mock_repo = Mock(spec=ArtistRepository)
    mock_repo.get_artists_with_stats.return_value = (
        [{'id': '123', 'name': 'Test Artist'}],
        1
    )

    # Inject mock
    service = AdminArtistService(db)
    service.artist_repo = mock_repo

    # Test service logic without hitting database
    result = service.get_artists_paginated(search='test')
    assert result['total'] == 1
```

## 📊 Performance Benefits

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Get 50 artists with stats | 51 queries | 2 queries | **96% reduction** |
| Get album with all artists | N+1 queries | 1 query | **Eliminates N+1** |
| Check 100 blocked IDs | 100 queries | 1 query | **99% reduction** |
| Delete track with cascade | 8 DELETE statements | 1 transaction | **Atomic operation** |

## 🚀 Best Practices

1. **Always use repositories in services** - Don't bypass them with direct DB queries
2. **Use batch methods** - When working with multiple entities
3. **Choose appropriate eager loading** - Basic for lists, full for single items
4. **Commit at service level** - Let services control transactions
5. **Use filters** - Instead of loading and filtering in Python
6. **Document complex queries** - Explain subqueries and aggregations

## 🔍 Common Patterns

### Pattern: Get entity with stats
```python
# Get single entity
artist = artist_repo.get_by_id(artist_id)
stats = artist_repo.get_track_stats(artist_id)

# Get multiple entities (batch optimized)
artists, total = artist_repo.paginate(limit=50, offset=0)
artist_ids = [a.id for a in artists]
stats_map = artist_repo.get_track_stats_batch(artist_ids)
```

### Pattern: Cascade operations
```python
# Get related data
pending_tracks = artist_repo.get_pending_tracks(artist_id)
track_ids = [t.id for t in pending_tracks]

# Delete with cascade
counts = track_repo.delete_with_cascade(track_ids)

# Clean up parent if empty
if artist_repo.count_non_pending_tracks(artist_id) == 0:
    artist_repo.delete_by_id(artist_id)

artist_repo.commit()
```

### Pattern: Conditional filtering
```python
# Build filters dynamically
filters = {}
if status:
    filters['processing_status'] = status
if is_verified is not None:
    filters['is_verified'] = is_verified

items, total = repo.paginate(
    filters=filters,
    search=search_term,
    search_fields=['name'],
    limit=50,
    offset=0
)
```

## 📝 TODOs & Future Improvements

- [ ] Add query performance logging/monitoring
- [ ] Implement Redis caching for frequently accessed data
- [ ] Add database connection pooling metrics
- [ ] Create integration tests for complex queries
- [ ] Add query timing decorators for profiling
- [ ] Implement read replicas for heavy read operations
- [ ] Add database index recommendations based on query patterns

## 🐛 Troubleshooting

### Issue: "DetachedInstanceError"
**Cause:** Trying to access relationships after session is closed
**Solution:** Use eager loading or access relationships before committing

```python
# ❌ BAD
track = track_repo.get_by_id(track_id)
track_repo.commit()
artist_name = track.artist_links[0].artist.name  # Error!

# ✅ GOOD
track = track_repo.get_by_id(track_id, eager_load=track_repo.get_eager_load_basic())
track_repo.commit()
artist_name = track.artist_links[0].artist.name  # Works!
```

### Issue: Slow pagination
**Cause:** Using `count()` on large filtered datasets
**Solution:** Consider caching total counts or using approximate counts

### Issue: Memory issues with large result sets
**Cause:** Loading too much data at once
**Solution:** Use `yield_per()` for streaming large datasets

```python
# Add to BaseRepository for streaming
def stream_results(self, filters=None, batch_size=1000):
    query = self._build_base_query()
    if filters:
        query = self._apply_filters(query, filters)

    for entity in query.yield_per(batch_size):
        yield entity
```

## 📖 Further Reading

- [SQLAlchemy ORM Documentation](https://docs.sqlalchemy.org/en/20/orm/)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
- [N+1 Query Problem](https://stackoverflow.com/questions/97197/what-is-the-n1-selects-problem)
