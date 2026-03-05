package se.dansbart.domain.album;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.lower;
import static org.jooq.impl.DSL.rand;
import static se.dansbart.jooq.Tables.ALBUMS;
import static se.dansbart.jooq.Tables.ARTISTS;
import static se.dansbart.jooq.Tables.TRACK_ALBUMS;
import static se.dansbart.jooq.Tables.TRACKS;

@Repository
public class AlbumJooqRepository {

    private final DSLContext dsl;

    public AlbumJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<Album> findById(UUID id) {
        return dsl.select(ALBUMS.asterisk(), ARTISTS.NAME)
            .from(ALBUMS)
            .leftJoin(ARTISTS).on(ARTISTS.ID.eq(ALBUMS.ARTIST_ID))
            .where(ALBUMS.ID.eq(id))
            .fetchOptional()
            .map(this::toAlbum);
    }

    public Page<Album> findAllRandom(Pageable pageable) {
        List<Album> items = dsl.select(ALBUMS.asterisk(), ARTISTS.NAME)
            .from(ALBUMS)
            .leftJoin(ARTISTS).on(ARTISTS.ID.eq(ALBUMS.ARTIST_ID))
            .orderBy(rand())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toAlbum);
        long total = dsl.fetchCount(dsl.selectFrom(ALBUMS));
        return new PageImpl<>(items, pageable, total);
    }

    public Page<Album> findAll(Pageable pageable) {
        var orderBy = pageable.getSort().stream()
            .findFirst()
            .map(s -> "title".equalsIgnoreCase(s.getProperty())
                ? (s.isAscending() ? ALBUMS.TITLE.asc() : ALBUMS.TITLE.desc())
                : ALBUMS.TITLE.asc())
            .orElse(ALBUMS.TITLE.asc());
        List<Album> items = dsl.select(ALBUMS.asterisk(), ARTISTS.NAME)
            .from(ALBUMS)
            .leftJoin(ARTISTS).on(ARTISTS.ID.eq(ALBUMS.ARTIST_ID))
            .orderBy(orderBy)
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toAlbum);
        long total = dsl.fetchCount(dsl.selectFrom(ALBUMS));
        return new PageImpl<>(items, pageable, total);
    }

    public List<Album> findByArtistId(UUID artistId) {
        return dsl.select(ALBUMS.asterisk(), ARTISTS.NAME)
            .from(ALBUMS)
            .leftJoin(ARTISTS).on(ARTISTS.ID.eq(ALBUMS.ARTIST_ID))
            .where(ALBUMS.ARTIST_ID.eq(artistId))
            .orderBy(ALBUMS.RELEASE_DATE.desc().nullsLast())
            .fetch(this::toAlbum);
    }

    public Page<Album> searchByTitle(String query, Pageable pageable) {
        String pattern = "%" + (query == null ? "" : query).toLowerCase() + "%";
        List<Album> items = dsl.select(ALBUMS.asterisk(), ARTISTS.NAME)
            .from(ALBUMS)
            .leftJoin(ARTISTS).on(ARTISTS.ID.eq(ALBUMS.ARTIST_ID))
            .where(lower(ALBUMS.TITLE).like(pattern))
            .orderBy(ALBUMS.TITLE.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toAlbum);
        long total = dsl.fetchCount(dsl.selectFrom(ALBUMS).where(lower(ALBUMS.TITLE).like(pattern)));
        return new PageImpl<>(items, pageable, total);
    }

    /**
     * Returns (album_id, pending_count) for albums that have at least one track with processing_status = 'PENDING'.
     */
    public List<Object[]> countPendingTracksByAlbumIds(List<UUID> albumIds) {
        if (albumIds == null || albumIds.isEmpty()) return List.of();
        return dsl.select(TRACK_ALBUMS.ALBUM_ID, count().as("pending_count"))
            .from(TRACK_ALBUMS)
            .join(TRACKS).on(TRACKS.ID.eq(TRACK_ALBUMS.TRACK_ID))
            .where(TRACK_ALBUMS.ALBUM_ID.in(albumIds))
            .and(TRACKS.PROCESSING_STATUS.eq("PENDING"))
            .groupBy(TRACK_ALBUMS.ALBUM_ID)
            .fetch()
            .map(r -> new Object[]{r.get(TRACK_ALBUMS.ALBUM_ID), r.get("pending_count", Long.class)});
    }

    public Map<UUID, Long> findTrackCountByAlbumIds(List<UUID> albumIds) {
        if (albumIds == null || albumIds.isEmpty()) return Map.of();
        Map<UUID, Long> out = new LinkedHashMap<>();
        var rows = dsl.select(TRACK_ALBUMS.ALBUM_ID, count().as("cnt"))
            .from(TRACK_ALBUMS)
            .where(TRACK_ALBUMS.ALBUM_ID.in(albumIds))
            .groupBy(TRACK_ALBUMS.ALBUM_ID)
            .fetch();
        for (var r : rows) {
            out.put(r.get(TRACK_ALBUMS.ALBUM_ID), r.get("cnt", Long.class));
        }
        return out;
    }

    public Album insert(Album album) {
        if (album.getId() == null) {
            album.setId(UUID.randomUUID());
        }
        dsl.insertInto(ALBUMS)
            .columns(ALBUMS.ID, ALBUMS.TITLE, ALBUMS.COVER_IMAGE_URL, ALBUMS.RELEASE_DATE, ALBUMS.ARTIST_ID, ALBUMS.SPOTIFY_ID)
            .values(album.getId(), album.getTitle(), album.getCoverImageUrl(), album.getReleaseDate(), album.getArtistId(), album.getSpotifyId())
            .execute();
        return album;
    }

    /** Insert a track–album link (for test fixtures). */
    public void insertTrackAlbum(UUID trackId, UUID albumId) {
        dsl.insertInto(TRACK_ALBUMS)
            .columns(TRACK_ALBUMS.ID, TRACK_ALBUMS.TRACK_ID, TRACK_ALBUMS.ALBUM_ID)
            .values(UUID.randomUUID(), trackId, albumId)
            .execute();
    }

    private Album toAlbum(Record r) {
        return Album.builder()
            .id(r.get(ALBUMS.ID))
            .title(r.get(ALBUMS.TITLE))
            .coverImageUrl(r.get(ALBUMS.COVER_IMAGE_URL))
            .releaseDate(r.get(ALBUMS.RELEASE_DATE))
            .spotifyId(r.get(ALBUMS.SPOTIFY_ID))
            .artistId(r.get(ALBUMS.ARTIST_ID))
            .artistName(r.indexOf(ARTISTS.NAME) >= 0 ? r.get(ARTISTS.NAME) : null)
            .build();
    }
}
