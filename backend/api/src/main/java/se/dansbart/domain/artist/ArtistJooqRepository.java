package se.dansbart.domain.artist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.ARTISTS;

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

    private Artist toArtist(Record r) {
        return Artist.builder()
            .id(r.get(ARTISTS.ID))
            .name(r.get(ARTISTS.NAME))
            .imageUrl(r.get(ARTISTS.IMAGE_URL))
            .spotifyId(r.get(ARTISTS.SPOTIFY_ID))
            .isVerified(r.get(ARTISTS.IS_VERIFIED) != null && r.get(ARTISTS.IS_VERIFIED))
            .build();
    }
}
