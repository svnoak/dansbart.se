package se.dansbart.domain.artist;

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
import static org.jooq.impl.DSL.rand;
import static se.dansbart.jooq.Tables.ARTISTS;
import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.TRACK_ARTISTS;

/**
 * Type-safe artist data access using jOOQ. Use for queries where you prefer
 * explicit SQL and generated table/column references over JPA.
 */
@Repository
public class ArtistJooqRepository {

    private final DSLContext dsl;

    public ArtistJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<Artist> findBySpotifyId(String spotifyId) {
        return dsl.selectFrom(ARTISTS)
            .where(ARTISTS.SPOTIFY_ID.eq(spotifyId))
            .fetchOptional()
            .map(this::toArtist);
    }

    public Optional<Artist> findById(UUID id) {
        return dsl.selectFrom(ARTISTS)
            .where(ARTISTS.ID.eq(id))
            .fetchOptional()
            .map(this::toArtist);
    }

    public Page<Artist> searchByName(String query, Pageable pageable) {
        String pattern = "%" + query.toLowerCase() + "%";
        var orderBy = pageable.getSort().stream()
            .findFirst()
            .map(s -> "name".equalsIgnoreCase(s.getProperty())
                ? (s.isAscending() ? ARTISTS.NAME.asc() : ARTISTS.NAME.desc())
                : ARTISTS.NAME.asc())
            .orElse(ARTISTS.NAME.asc());

        List<Artist> items = dsl.selectFrom(ARTISTS)
            .where(ARTISTS.NAME.lower().like(pattern))
            .orderBy(orderBy)
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toArtist);

        long total = dsl.fetchCount(
            dsl.selectFrom(ARTISTS).where(ARTISTS.NAME.lower().like(pattern))
        );

        return new PageImpl<>(items, pageable, total);
    }

    public Page<Artist> findVerifiedArtists(Pageable pageable) {
        List<Artist> items = dsl.selectFrom(ARTISTS)
            .where(ARTISTS.IS_VERIFIED.eq(true))
            .orderBy(ARTISTS.NAME.asc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toArtist);

        long total = dsl.fetchCount(
            dsl.selectFrom(ARTISTS).where(ARTISTS.IS_VERIFIED.eq(true))
        );

        return new PageImpl<>(items, pageable, total);
    }

    public Page<Artist> findAllRandom(Pageable pageable) {
        List<Artist> items = dsl.selectFrom(ARTISTS)
            .orderBy(rand())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toArtist);
        long total = dsl.fetchCount(dsl.selectFrom(ARTISTS));
        return new PageImpl<>(items, pageable, total);
    }

    public Page<Artist> findAll(Pageable pageable) {
        var orderBy = pageable.getSort().stream()
            .findFirst()
            .map(s -> "name".equalsIgnoreCase(s.getProperty())
                ? (s.isAscending() ? ARTISTS.NAME.asc() : ARTISTS.NAME.desc())
                : ARTISTS.NAME.asc())
            .orElse(ARTISTS.NAME.asc());

        List<Artist> items = dsl.selectFrom(ARTISTS)
            .orderBy(orderBy)
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toArtist);

        long total = dsl.fetchCount(dsl.selectFrom(ARTISTS));
        return new PageImpl<>(items, pageable, total);
    }

    /**
     * Returns (artist_id, pending_count) for artists that have at least one track with processing_status = 'PENDING'.
     */
    public List<Object[]> countPendingTracksByArtistIds(List<UUID> artistIds) {
        if (artistIds == null || artistIds.isEmpty()) return List.of();
        return dsl.select(TRACK_ARTISTS.ARTIST_ID, count().as("pending_count"))
            .from(TRACK_ARTISTS)
            .join(TRACKS).on(TRACKS.ID.eq(TRACK_ARTISTS.TRACK_ID))
            .where(TRACK_ARTISTS.ARTIST_ID.in(artistIds))
            .and(TRACKS.PROCESSING_STATUS.eq("PENDING"))
            .groupBy(TRACK_ARTISTS.ARTIST_ID)
            .fetch()
            .map(r -> new Object[]{r.get(TRACK_ARTISTS.ARTIST_ID), r.get("pending_count", Long.class)});
    }

    /**
     * Returns track count per artist id for the given artist ids.
     */
    public Map<UUID, Long> findTrackCountByArtistIds(List<UUID> artistIds) {
        if (artistIds == null || artistIds.isEmpty()) return Map.of();
        Map<UUID, Long> out = new LinkedHashMap<>();
        var rows = dsl.select(TRACK_ARTISTS.ARTIST_ID, count().as("cnt"))
            .from(TRACK_ARTISTS)
            .where(TRACK_ARTISTS.ARTIST_ID.in(artistIds))
            .groupBy(TRACK_ARTISTS.ARTIST_ID)
            .fetch();
        for (var r : rows) {
            out.put(r.get(TRACK_ARTISTS.ARTIST_ID), r.get("cnt", Long.class));
        }
        return out;
    }

    public List<UUID> getTrackIdsByArtistId(UUID artistId) {
        return dsl.select(TRACK_ARTISTS.TRACK_ID)
            .from(TRACK_ARTISTS)
            .where(TRACK_ARTISTS.ARTIST_ID.eq(artistId))
            .fetch(TRACK_ARTISTS.TRACK_ID);
    }

    /**
     * Returns (track_id, artist_id) for all track_artists rows for the given track ids.
     */
    public List<Object[]> getTrackArtistsByTrackIds(List<UUID> trackIds) {
        if (trackIds == null || trackIds.isEmpty()) return List.of();
        return dsl.select(TRACK_ARTISTS.TRACK_ID, TRACK_ARTISTS.ARTIST_ID)
            .from(TRACK_ARTISTS)
            .where(TRACK_ARTISTS.TRACK_ID.in(trackIds))
            .fetch()
            .map(r -> new Object[]{r.get(TRACK_ARTISTS.TRACK_ID), r.get(TRACK_ARTISTS.ARTIST_ID)});
    }

    public List<Artist> findByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        return dsl.selectFrom(ARTISTS).where(ARTISTS.ID.in(ids)).fetch(this::toArtist);
    }

    public Artist insert(Artist artist) {
        if (artist.getId() == null) {
            artist.setId(UUID.randomUUID());
        }
        dsl.insertInto(ARTISTS)
            .columns(ARTISTS.ID, ARTISTS.NAME, ARTISTS.IMAGE_URL, ARTISTS.SPOTIFY_ID, ARTISTS.IS_VERIFIED)
            .values(artist.getId(), artist.getName(), artist.getImageUrl(), artist.getSpotifyId(), artist.getIsVerified() != null && artist.getIsVerified())
            .execute();
        return artist;
    }

    public Artist update(Artist artist) {
        dsl.update(ARTISTS)
            .set(ARTISTS.NAME, artist.getName())
            .set(ARTISTS.IMAGE_URL, artist.getImageUrl())
            .set(ARTISTS.SPOTIFY_ID, artist.getSpotifyId())
            .set(ARTISTS.IS_VERIFIED, artist.getIsVerified() != null && artist.getIsVerified())
            .where(ARTISTS.ID.eq(artist.getId()))
            .execute();
        return artist;
    }

    public void updateDescription(UUID id, String description) {
        dsl.update(ARTISTS)
            .set(ARTISTS.DESCRIPTION, description)
            .where(ARTISTS.ID.eq(id))
            .execute();
    }

    private Artist toArtist(Record r) {
        return Artist.builder()
            .id(r.get(ARTISTS.ID))
            .name(r.get(ARTISTS.NAME))
            .imageUrl(r.get(ARTISTS.IMAGE_URL))
            .spotifyId(r.get(ARTISTS.SPOTIFY_ID))
            .isVerified(r.get(ARTISTS.IS_VERIFIED) != null && r.get(ARTISTS.IS_VERIFIED))
            .description(r.get(ARTISTS.DESCRIPTION))
            .build();
    }
}
