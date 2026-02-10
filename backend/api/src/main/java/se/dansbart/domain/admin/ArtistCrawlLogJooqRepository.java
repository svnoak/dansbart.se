package se.dansbart.domain.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.sum;
import static se.dansbart.jooq.Tables.ARTIST_CRAWL_LOGS;

@Repository
public class ArtistCrawlLogJooqRepository {

    private final DSLContext dsl;

    public ArtistCrawlLogJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Page<ArtistCrawlLog> findAllByOrderByCrawledAtDesc(Pageable pageable) {
        long total = dsl.fetchCount(ARTIST_CRAWL_LOGS);
        List<ArtistCrawlLog> content = dsl.selectFrom(ARTIST_CRAWL_LOGS)
            .orderBy(ARTIST_CRAWL_LOGS.CRAWLED_AT.desc())
            .offset((int) pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toLog);
        return new PageImpl<>(content, pageable, total);
    }

    public long countLogs() {
        return dsl.fetchCount(ARTIST_CRAWL_LOGS);
    }

    public Long sumTracksFound() {
        return dsl.select(sum(ARTIST_CRAWL_LOGS.TRACKS_FOUND))
            .from(ARTIST_CRAWL_LOGS)
            .fetchOne(0, Long.class);
    }

    public List<Object[]> countByMusicGenre() {
        return dsl.select(ARTIST_CRAWL_LOGS.MUSIC_GENRE_CLASSIFICATION, count())
            .from(ARTIST_CRAWL_LOGS)
            .groupBy(ARTIST_CRAWL_LOGS.MUSIC_GENRE_CLASSIFICATION)
            .fetch(r -> new Object[]{r.get(ARTIST_CRAWL_LOGS.MUSIC_GENRE_CLASSIFICATION), r.get(1, Long.class)});
    }

    public List<Object[]> countByStatus() {
        return dsl.select(ARTIST_CRAWL_LOGS.STATUS, count())
            .from(ARTIST_CRAWL_LOGS)
            .groupBy(ARTIST_CRAWL_LOGS.STATUS)
            .fetch(r -> new Object[]{r.get(ARTIST_CRAWL_LOGS.STATUS), r.get(1, Long.class)});
    }

    public boolean existsBySpotifyArtistId(String spotifyArtistId) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(ARTIST_CRAWL_LOGS)
                .where(ARTIST_CRAWL_LOGS.SPOTIFY_ARTIST_ID.eq(spotifyArtistId))
        );
    }

    public void deleteAll() {
        dsl.deleteFrom(ARTIST_CRAWL_LOGS).execute();
    }

    private ArtistCrawlLog toLog(Record r) {
        ArtistCrawlLog log = new ArtistCrawlLog();
        log.setId(r.get(ARTIST_CRAWL_LOGS.ID));
        log.setSpotifyArtistId(r.get(ARTIST_CRAWL_LOGS.SPOTIFY_ARTIST_ID));
        log.setArtistName(r.get(ARTIST_CRAWL_LOGS.ARTIST_NAME));
        log.setCrawledAt(r.get(ARTIST_CRAWL_LOGS.CRAWLED_AT));
        log.setTracksFound(r.get(ARTIST_CRAWL_LOGS.TRACKS_FOUND));
        log.setStatus(r.get(ARTIST_CRAWL_LOGS.STATUS));
        // detectedGenres JSONB left null; same for musicGenreClassification/discoverySource mapping
        log.setMusicGenreClassification(r.get(ARTIST_CRAWL_LOGS.MUSIC_GENRE_CLASSIFICATION));
        log.setDiscoverySource(r.get(ARTIST_CRAWL_LOGS.DISCOVERY_SOURCE));
        return log;
    }
}

