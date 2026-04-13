package se.dansbart.domain.track;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.OrderField;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import se.dansbart.dto.PlaybackLinkDto;
import se.dansbart.dto.TrackListDto;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.countDistinct;
import static se.dansbart.jooq.Tables.*;

/**
 * jOOQ-based repository for tracks (reads and writes). All track access goes through this repository.
 */
@Repository
public class TrackJooqRepository {

    private static final TypeReference<List<Double>> LIST_DOUBLE = new TypeReference<>() {};
    private static final TypeReference<List<String>> LIST_STRING = new TypeReference<>() {};

    private final DSLContext dsl;
    private final ObjectMapper objectMapper;

    public TrackJooqRepository(DSLContext dsl, ObjectMapper objectMapper) {
        this.dsl = dsl;
        this.objectMapper = objectMapper;
    }

    public Optional<Track> findById(UUID id) {
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.eq(id)).fetchOptional().map(this::toTrack);
    }

    /** Insert a track (e.g. for test fixtures). Sets id if null. */
    public Track insert(Track track) {
        if (track.getId() == null) {
            track.setId(UUID.randomUUID());
        }
        dsl.insertInto(TRACKS)
            .columns(TRACKS.ID, TRACKS.TITLE, TRACKS.ISRC, TRACKS.DURATION_MS, TRACKS.PROCESSING_STATUS,
                TRACKS.HAS_VOCALS, TRACKS.SWING_RATIO, TRACKS.ARTICULATION, TRACKS.BOUNCINESS, TRACKS.LOUDNESS)
            .values(
                track.getId(),
                track.getTitle(),
                track.getIsrc(),
                track.getDurationMs(),
                track.getProcessingStatus() != null ? track.getProcessingStatus() : "PENDING",
                track.getHasVocals(),
                track.getSwingRatio() != null ? track.getSwingRatio().doubleValue() : null,
                track.getArticulation() != null ? track.getArticulation().doubleValue() : null,
                track.getBounciness() != null ? track.getBounciness().doubleValue() : null,
                track.getLoudness() != null ? track.getLoudness().doubleValue() : null
            )
            .execute();
        return track;
    }

    /** Insert a track–artist link (for test fixtures). */
    public void insertTrackArtist(UUID trackId, UUID artistId, String role) {
        dsl.insertInto(TRACK_ARTISTS)
            .columns(TRACK_ARTISTS.ID, TRACK_ARTISTS.TRACK_ID, TRACK_ARTISTS.ARTIST_ID, TRACK_ARTISTS.ROLE)
            .values(UUID.randomUUID(), trackId, artistId, role != null ? role : "primary")
            .execute();
    }

    public boolean existsById(UUID id) {
        return dsl.fetchExists(dsl.selectOne().from(TRACKS).where(TRACKS.ID.eq(id)));
    }

    public List<Track> findByIds(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return List.of();
        List<Track> list = dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
        // Preserve order of ids
        Map<UUID, Track> byId = new LinkedHashMap<>();
        for (Track t : list) byId.put(t.getId(), t);
        List<Track> ordered = new ArrayList<>();
        for (UUID id : ids) {
            Track t = byId.get(id);
            if (t != null) ordered.add(t);
        }
        return ordered;
    }

    /**
     * Build TrackListDto for each track ID (preserving order). Uses batch queries for dance style,
     * playback links, and artist name. Album cover is intentionally not included (copyright).
     */
    public List<TrackListDto> findTrackListDtosByIds(List<UUID> trackIds) {
        if (trackIds == null || trackIds.isEmpty()) return List.of();
        Map<UUID, TrackListDto> dtoById = new LinkedHashMap<>();
        dsl.select(TRACKS.ID, TRACKS.TITLE, TRACKS.DURATION_MS, TRACKS.HAS_VOCALS)
            .from(TRACKS)
            .where(TRACKS.ID.in(trackIds))
            .forEach(r -> dtoById.put(r.get(TRACKS.ID), TrackListDto.builder()
                .id(r.get(TRACKS.ID))
                .title(r.get(TRACKS.TITLE))
                .durationMs(r.get(TRACKS.DURATION_MS))
                .hasVocals(r.get(TRACKS.HAS_VOCALS))
                .build()));
        Map<UUID, StyleInfo> styleByTrack = new LinkedHashMap<>();
        dsl.select(TRACK_DANCE_STYLES.TRACK_ID, TRACK_DANCE_STYLES.DANCE_STYLE, TRACK_DANCE_STYLES.SUB_STYLE,
                TRACK_DANCE_STYLES.EFFECTIVE_BPM, TRACK_DANCE_STYLES.TEMPO_CATEGORY, TRACK_DANCE_STYLES.CONFIDENCE)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.in(trackIds).and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true)))
            .forEach(r -> {
                UUID tid = r.get(TRACK_DANCE_STYLES.TRACK_ID);
                if (!styleByTrack.containsKey(tid)) {
                    Double c = r.get(TRACK_DANCE_STYLES.CONFIDENCE);
                    styleByTrack.put(tid, new StyleInfo(
                        r.get(TRACK_DANCE_STYLES.DANCE_STYLE),
                        r.get(TRACK_DANCE_STYLES.SUB_STYLE),
                        r.get(TRACK_DANCE_STYLES.EFFECTIVE_BPM),
                        r.get(TRACK_DANCE_STYLES.TEMPO_CATEGORY),
                        c != null ? c.floatValue() : null));
                }
            });
        Map<UUID, List<PlaybackLinkDto>> playbackByTrack = new LinkedHashMap<>();
        dsl.select(PLAYBACK_LINKS.TRACK_ID, PLAYBACK_LINKS.PLATFORM, PLAYBACK_LINKS.DEEP_LINK)
            .from(PLAYBACK_LINKS)
            .where(PLAYBACK_LINKS.TRACK_ID.in(trackIds).and(PLAYBACK_LINKS.IS_WORKING.eq(true)))
            .orderBy(PLAYBACK_LINKS.PLATFORM.asc())
            .forEach(r -> {
                UUID tid = r.get(PLAYBACK_LINKS.TRACK_ID);
                playbackByTrack
                    .computeIfAbsent(tid, k -> new ArrayList<>())
                    .add(PlaybackLinkDto.builder()
                        .platform(r.get(PLAYBACK_LINKS.PLATFORM))
                        .deepLink(r.get(PLAYBACK_LINKS.DEEP_LINK))
                        .build());
            });
        Map<UUID, UUID> artistIdByTrack = new LinkedHashMap<>();
        Map<UUID, String> artistNameByTrack = new LinkedHashMap<>();
        dsl.select(TRACK_ARTISTS.TRACK_ID, ARTISTS.ID, ARTISTS.NAME)
            .from(TRACK_ARTISTS)
            .join(ARTISTS).on(TRACK_ARTISTS.ARTIST_ID.eq(ARTISTS.ID))
            .where(TRACK_ARTISTS.TRACK_ID.in(trackIds))
            .orderBy(TRACK_ARTISTS.ROLE.eq("primary").desc())
            .forEach(r -> {
                UUID tid = r.get(TRACK_ARTISTS.TRACK_ID);
                if (!artistNameByTrack.containsKey(tid)) {
                    artistIdByTrack.put(tid, r.get(ARTISTS.ID));
                    artistNameByTrack.put(tid, r.get(ARTISTS.NAME));
                }
            });
        Map<UUID, UUID> albumIdByTrack = new LinkedHashMap<>();
        Map<UUID, String> albumTitleByTrack = new LinkedHashMap<>();
        dsl.select(TRACK_ALBUMS.TRACK_ID, ALBUMS.ID, ALBUMS.TITLE)
            .from(TRACK_ALBUMS)
            .join(ALBUMS).on(TRACK_ALBUMS.ALBUM_ID.eq(ALBUMS.ID))
            .where(TRACK_ALBUMS.TRACK_ID.in(trackIds))
            .forEach(r -> {
                UUID tid = r.get(TRACK_ALBUMS.TRACK_ID);
                if (!albumIdByTrack.containsKey(tid)) {
                    albumIdByTrack.put(tid, r.get(ALBUMS.ID));
                    albumTitleByTrack.put(tid, r.get(ALBUMS.TITLE));
                }
            });
        for (UUID id : trackIds) {
            TrackListDto dto = dtoById.get(id);
            if (dto == null) continue;
            StyleInfo style = styleByTrack.get(id);
            if (style != null) {
                dto.setDanceStyle(style.danceStyle);
                dto.setSubStyle(style.subStyle);
                dto.setEffectiveBpm(style.effectiveBpm);
                dto.setTempoCategory(style.tempoCategory);
                dto.setConfidence(style.confidence);
            }
            List<PlaybackLinkDto> links = playbackByTrack.get(id);
            if (links != null && !links.isEmpty()) {
                dto.setPlaybackLinks(links);
            }
            dto.setArtistId(artistIdByTrack.get(id));
            dto.setArtistName(artistNameByTrack.get(id));
            dto.setAlbumId(albumIdByTrack.get(id));
            dto.setAlbumTitle(albumTitleByTrack.get(id));
        }
        List<TrackListDto> ordered = new ArrayList<>();
        for (UUID id : trackIds) {
            ordered.add(dtoById.get(id));
        }
        return ordered;
    }

    private record StyleInfo(String danceStyle, String subStyle, Integer effectiveBpm, String tempoCategory, Float confidence) {}

    public Page<Track> searchByTitle(String query, Pageable pageable) {
        String pattern = "%" + (query == null ? "" : query).toLowerCase() + "%";
        List<Track> items = dsl.selectFrom(TRACKS)
            .where(DSL.lower(TRACKS.TITLE).like(pattern))
            .orderBy(TRACKS.CREATED_AT.desc())
            .offset(pageable.getOffset())
            .limit(pageable.getPageSize())
            .fetch(this::toTrack);
        long total = dsl.fetchCount(dsl.selectFrom(TRACKS).where(DSL.lower(TRACKS.TITLE).like(pattern)));
        return new PageImpl<>(items, pageable, total);
    }

    public List<Track> findByArtistId(UUID artistId) {
        return dsl.selectFrom(TRACKS)
            .where(TRACKS.ID.in(dsl.select(TRACK_ARTISTS.TRACK_ID).from(TRACK_ARTISTS).where(TRACK_ARTISTS.ARTIST_ID.eq(artistId))))
            .orderBy(TRACKS.TITLE)
            .fetch(this::toTrack);
    }

    public List<Track> findByAlbumId(UUID albumId) {
        return dsl.selectFrom(TRACKS)
            .where(TRACKS.ID.in(dsl.select(TRACK_ALBUMS.TRACK_ID).from(TRACK_ALBUMS).where(TRACK_ALBUMS.ALBUM_ID.eq(albumId))))
            .orderBy(TRACKS.TITLE)
            .fetch(this::toTrack);
    }

    /**
     * Similar tracks by embedding L2 distance. Excludes the reference track; does not set embedding on returned Track.
     */
    @SuppressWarnings("SqlNoDataSource")
    public List<Track> findSimilarTracks(UUID trackId, int limit) {
        if (limit <= 0) return List.of();
        var orderBySql = DSL.sql("tracks.embedding <-> (SELECT embedding FROM tracks WHERE id = ?)", trackId);
        return dsl.selectFrom(TRACKS)
            .where(TRACKS.ID.ne(trackId))
            .and(TRACKS.EMBEDDING.isNotNull())
            .and(TRACKS.PROCESSING_STATUS.in("DONE", "REANALYZING"))
            .orderBy(DSL.field(orderBySql))
            .limit(limit)
            .fetch(this::toTrack);
    }

    public List<Track> findPlayableTracksWithFilters(
        String mainStyle,
        String subStyle,
        String search,
        String source,
        Boolean hasVocals,
        Float minConfidence,
        String musicGenre,
        Integer minBpm,
        Integer maxBpm,
        Integer minDurationMs,
        Integer maxDurationMs,
        Float minBounciness,
        Float maxBounciness,
        Float minArticulation,
        Float maxArticulation,
        int limit,
        int offset,
        String sortBy,
        String sortDirection
    ) {
        var sub = buildPlayableTracksCondition(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation
        );
        var yt = PLAYBACK_LINKS.as("yt");
        var hasYoutube = DSL.exists(
            DSL.selectOne().from(yt).where(
                yt.TRACK_ID.eq(TRACKS.ID)
                    .and(yt.PLATFORM.eq("youtube"))
                    .and(yt.IS_WORKING.eq(true))
            )
        );

        // Build order clause
        List<OrderField<?>> orderFields = new ArrayList<>();
        if (sortBy != null && !sortBy.isBlank()) {
            boolean asc = "asc".equalsIgnoreCase(sortDirection);
            switch (sortBy) {
                case "tempoBpm" -> orderFields.add(asc ? TRACKS.TEMPO_BPM.asc().nullsLast() : TRACKS.TEMPO_BPM.desc().nullsLast());
                case "durationMs" -> orderFields.add(asc ? TRACKS.DURATION_MS.asc().nullsLast() : TRACKS.DURATION_MS.desc().nullsLast());
                case "confidence" -> orderFields.add(asc ? DSL.max(TRACK_DANCE_STYLES.CONFIDENCE).asc().nullsLast() : DSL.max(TRACK_DANCE_STYLES.CONFIDENCE).desc().nullsLast());
                default -> {} // fall through to default ordering
            }
        }
        // Default ordering as fallback (or when no explicit sort)
        if (orderFields.isEmpty()) {
            orderFields.add(DSL.when(hasYoutube, DSL.inline(0)).otherwise(DSL.inline(1)).asc());
            orderFields.add(DSL.max(TRACK_DANCE_STYLES.CONFIDENCE).desc().nullsLast());
        }

        var orderedIds = dsl.select(TRACKS.ID)
            .from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(sub)
            .groupBy(TRACKS.ID)
            .orderBy(orderFields)
            .limit(limit)
            .offset(offset)
            .fetch(TRACKS.ID);
        if (orderedIds.isEmpty()) return List.of();
        Map<UUID, Track> trackMap = new LinkedHashMap<>();
        dsl.selectFrom(TRACKS)
            .where(TRACKS.ID.in(orderedIds))
            .fetch(this::toTrack)
            .forEach(t -> trackMap.put(t.getId(), t));
        return orderedIds.stream()
            .map(trackMap::get)
            .filter(t -> t != null)
            .toList();
    }

    public long countPlayableTracksWithFilters(
        String mainStyle,
        String subStyle,
        String search,
        String source,
        Boolean hasVocals,
        Float minConfidence,
        String musicGenre,
        Integer minBpm,
        Integer maxBpm,
        Integer minDurationMs,
        Integer maxDurationMs,
        Float minBounciness,
        Float maxBounciness,
        Float minArticulation,
        Float maxArticulation
    ) {
        var sub = buildPlayableTracksCondition(
            mainStyle, subStyle, search, source, hasVocals, minConfidence, musicGenre,
            minBpm, maxBpm, minDurationMs, maxDurationMs,
            minBounciness, maxBounciness, minArticulation, maxArticulation
        );
        var subquery = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(sub);
        return dsl.selectCount().from(subquery.asTable("ids")).fetchOne(0, Long.class);
    }

    private Condition buildPlayableTracksCondition(
        String mainStyle,
        String subStyle,
        String search,
        String source,
        Boolean hasVocals,
        Float minConfidence,
        String musicGenre,
        Integer minBpm,
        Integer maxBpm,
        Integer minDurationMs,
        Integer maxDurationMs,
        Float minBounciness,
        Float maxBounciness,
        Float minArticulation,
        Float maxArticulation
    ) {
        Condition c = PLAYBACK_LINKS.IS_WORKING.eq(true)
            .and(TRACKS.PROCESSING_STATUS.in("DONE", "REANALYZING"))
            .and(TRACKS.IS_FLAGGED.eq(false));
        if (mainStyle != null && !mainStyle.isBlank()) c = c.and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(mainStyle));
        if (subStyle != null && !subStyle.isBlank()) c = c.and(TRACK_DANCE_STYLES.SUB_STYLE.eq(subStyle));
        if (search != null && !search.isBlank()) c = c.and(DSL.lower(TRACKS.TITLE).like("%" + search.toLowerCase() + "%"));
        if (source != null && !source.isBlank()) c = c.and(PLAYBACK_LINKS.PLATFORM.eq(source));
        if (hasVocals != null) c = c.and(TRACKS.HAS_VOCALS.eq(hasVocals));
        if (minConfidence != null) c = c.and(TRACK_DANCE_STYLES.CONFIDENCE.ge(minConfidence.doubleValue()));
        if (musicGenre != null && !musicGenre.isBlank()) c = c.and(TRACKS.MUSIC_GENRE.eq(musicGenre));
        if (minBpm != null) c = c.and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.ge(minBpm));
        if (maxBpm != null) c = c.and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.le(maxBpm));
        if (minDurationMs != null) c = c.and(TRACKS.DURATION_MS.ge(minDurationMs));
        if (maxDurationMs != null) c = c.and(TRACKS.DURATION_MS.le(maxDurationMs));
        if (minBounciness != null) c = c.and(TRACKS.BOUNCINESS.ge(minBounciness.doubleValue()));
        if (maxBounciness != null) c = c.and(TRACKS.BOUNCINESS.le(maxBounciness.doubleValue()));
        if (minArticulation != null) c = c.and(TRACKS.ARTICULATION.ge(minArticulation.doubleValue()));
        if (maxArticulation != null) c = c.and(TRACKS.ARTICULATION.le(maxArticulation.doubleValue()));
        return c;
    }

    public List<Track> findRecentVerifiedTracks(int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge(1.0))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        return findByIds(ids);
    }

    public List<Track> findCuratedTracks(int limit) {
        var playsSub = dsl.select(TRACK_PLAYBACKS.TRACK_ID, DSL.count(TRACK_PLAYBACKS.ID).as("plays"))
            .from(TRACK_PLAYBACKS)
            .groupBy(TRACK_PLAYBACKS.TRACK_ID).asTable("tp");
        var ids = dsl.selectDistinct(TRACKS.ID)
            .from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .leftJoin(playsSub).on(TRACKS.ID.eq(playsSub.field("track_id", UUID.class)))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.eq(1.0))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACKS.BOUNCINESS.isNotNull())
            .and(TRACKS.ARTICULATION.isNotNull())
            .orderBy(coalesce(playsSub.field("plays", Long.class), 0L).desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        return findByIds(ids);
    }

    public List<Track> findFallbackTracks(int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge(0.8))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        return findByIds(ids);
    }

    public List<Object[]> findStyleCounts() {
        return dsl.select(TRACK_DANCE_STYLES.DANCE_STYLE, countDistinct(TRACKS.ID).as("track_count"))
            .from(TRACK_DANCE_STYLES)
            .join(TRACKS).on(TRACKS.ID.eq(TRACK_DANCE_STYLES.TRACK_ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACK_DANCE_STYLES.DANCE_STYLE.isNotNull())
            .and(TRACKS.IS_FLAGGED.eq(false))
            .groupBy(TRACK_DANCE_STYLES.DANCE_STYLE)
            .orderBy(countDistinct(TRACKS.ID).desc())
            .fetch()
            .map(r -> new Object[]{r.get(TRACK_DANCE_STYLES.DANCE_STYLE), r.get("track_count", Long.class)});
    }

    /**
     * Among the given track IDs, returns those that have a non-primary (secondary) style row with DANCE_STYLE = mainStyle.
     * Used when listing tracks with a style filter so the UI can show the matching secondary style in the pill.
     */
    public Set<UUID> findTrackIdsWithSecondaryStyle(List<UUID> trackIds, String mainStyle) {
        if (trackIds == null || trackIds.isEmpty() || mainStyle == null || mainStyle.isBlank()) return Set.of();
        return dsl.selectDistinct(TRACK_DANCE_STYLES.TRACK_ID)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.in(trackIds))
            .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(mainStyle))
            .and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(false))
            .fetchSet(TRACK_DANCE_STYLES.TRACK_ID);
    }

    public List<String> findSubStylesForStyle(String mainStyle) {
        return dsl.selectDistinct(TRACK_DANCE_STYLES.SUB_STYLE)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.DANCE_STYLE.eq(mainStyle))
            .and(TRACK_DANCE_STYLES.SUB_STYLE.isNotNull())
            .and(TRACK_DANCE_STYLES.CONFIDENCE.gt(0.3))
            .fetch(TRACK_DANCE_STYLES.SUB_STYLE);
    }

    public List<Track> findByStyleWithConfidence(String style, float minConfidence, int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(style))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge((double) minConfidence))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public List<Track> findByStylesWithConfidence(List<String> styles, float minConfidence, int limit) {
        if (styles == null || styles.isEmpty()) return List.of();
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACK_DANCE_STYLES.DANCE_STYLE.in(styles))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge((double) minConfidence))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public List<Track> findInstrumentalTracks(float minConfidence, int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACKS.HAS_VOCALS.eq(false))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge((double) minConfidence))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public List<Track> findSlowTracks(int maxBpm, float minConfidence, int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.isNotNull())
            .and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.le(maxBpm))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge((double) minConfidence))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public List<Track> findFastTracks(int minBpm, float minConfidence, int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.isNotNull())
            .and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.ge(minBpm))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge((double) minConfidence))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public List<Track> findBeginnerFriendlyByStyle(String style, int limit) {
        var ids = dsl.selectDistinct(TRACKS.ID).from(TRACKS)
            .join(TRACK_DANCE_STYLES).on(TRACK_DANCE_STYLES.TRACK_ID.eq(TRACKS.ID))
            .join(PLAYBACK_LINKS).on(PLAYBACK_LINKS.TRACK_ID.eq(TRACKS.ID))
            .where(PLAYBACK_LINKS.IS_WORKING.eq(true))
            .and(TRACKS.IS_FLAGGED.eq(false))
            .and(TRACKS.HAS_VOCALS.eq(false))
            .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq(style))
            .and(TRACK_DANCE_STYLES.CONFIDENCE.ge(0.8))
            .and(TRACK_DANCE_STYLES.EFFECTIVE_BPM.isNull().or(TRACK_DANCE_STYLES.EFFECTIVE_BPM.between(80, 140)))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
        if (ids.isEmpty()) return List.of();
        return dsl.selectFrom(TRACKS).where(TRACKS.ID.in(ids)).fetch(this::toTrack);
    }

    public void setProcessingStatus(UUID id, String status) {
        dsl.update(TRACKS).set(TRACKS.PROCESSING_STATUS, status).where(TRACKS.ID.eq(id)).execute();
    }

    /**
     * Delete a track and all non-cascading relations that reference it.
     */
    public void deleteWithRelations(UUID id) {
        if (id == null) return;

        // Relations without ON DELETE CASCADE
        dsl.deleteFrom(TRACK_ALBUMS).where(TRACK_ALBUMS.TRACK_ID.eq(id)).execute();
        dsl.deleteFrom(TRACK_ARTISTS).where(TRACK_ARTISTS.TRACK_ID.eq(id)).execute();
        dsl.deleteFrom(TRACK_PLAYBACKS).where(TRACK_PLAYBACKS.TRACK_ID.eq(id)).execute();
        dsl.deleteFrom(USER_INTERACTIONS).where(USER_INTERACTIONS.TRACK_ID.eq(id)).execute();

        // Finally delete the track row itself
        dsl.deleteFrom(TRACKS).where(TRACKS.ID.eq(id)).execute();
    }

    public void deleteById(UUID id) {
        dsl.deleteFrom(TRACKS).where(TRACKS.ID.eq(id)).execute();
    }

    public void deleteAllById(Iterable<UUID> ids) {
        if (ids == null) return;
        List<UUID> list = new ArrayList<>();
        ids.forEach(list::add);
        if (list.isEmpty()) return;
        dsl.deleteFrom(TRACKS).where(TRACKS.ID.in(list)).execute();
    }

    /**
     * Batch update processing status for the given track IDs.
     */
    public void setProcessingStatusBatch(List<UUID> trackIds, String status) {
        if (trackIds == null || trackIds.isEmpty()) return;
        dsl.update(TRACKS).set(TRACKS.PROCESSING_STATUS, status).where(TRACKS.ID.in(trackIds)).execute();
    }

    public void updateTrack(Track track) {
        if (track == null || track.getId() == null) return;
        dsl.update(TRACKS)
            .set(TRACKS.PROCESSING_STATUS, track.getProcessingStatus())
            .set(TRACKS.IS_FLAGGED, track.getIsFlagged())
            .set(TRACKS.FLAG_REASON, track.getFlagReason())
            .set(TRACKS.FLAGGED_AT, track.getFlaggedAt())
            .where(TRACKS.ID.eq(track.getId()))
            .execute();
    }

    /** Fetch track IDs for bulk operations. Order by created_at desc. */
    public List<UUID> findIdsByProcessingStatusOrderByCreatedAtDesc(String status, int limit) {
        return dsl.select(TRACKS.ID).from(TRACKS)
            .where(TRACKS.PROCESSING_STATUS.eq(status))
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .fetch(TRACKS.ID);
    }

    /** All track IDs up to limit, order by created_at desc. */
    public List<UUID> findIdsOrderByCreatedAtDesc(int limit) {
        return dsl.select(TRACKS.ID).from(TRACKS).orderBy(TRACKS.CREATED_AT.desc()).limit(limit).fetch(TRACKS.ID);
    }

    /** Track IDs that are not DONE, up to limit. */
    public List<UUID> findIdsWhereProcessingStatusNotDone(int limit) {
        return dsl.select(TRACKS.ID).from(TRACKS)
            .where(TRACKS.PROCESSING_STATUS.ne("DONE"))
            .orderBy(TRACKS.CREATED_AT.asc())
            .limit(limit)
            .fetch(TRACKS.ID);
    }

    /** Track IDs by status, order created_at asc (e.g. for queueing PENDING). */
    public List<UUID> findIdsByProcessingStatusOrderByCreatedAtAsc(String status, int limit) {
        return dsl.select(TRACKS.ID).from(TRACKS)
            .where(TRACKS.PROCESSING_STATUS.eq(status))
            .orderBy(TRACKS.CREATED_AT.asc())
            .limit(limit)
            .fetch(TRACKS.ID);
    }

    /** All tracks ordered by created_at, with limit/offset (for export). */
    public List<Track> findAllOrderByCreatedAt(int limit, int offset) {
        return dsl.selectFrom(TRACKS)
            .orderBy(TRACKS.CREATED_AT.asc())
            .offset(offset)
            .limit(limit)
            .fetch(this::toTrack);
    }

    public long countTracks() {
        return dsl.fetchCount(TRACKS);
    }

    public long countTracksWithAnalysis() {
        return dsl.fetchCount(
            dsl.selectFrom(TRACKS).where(TRACKS.ANALYSIS_VERSION.isNotNull())
        );
    }

    /** Tracks by status (e.g. PENDING for bulk delete). */
    public List<Track> findByProcessingStatus(String status) {
        return dsl.selectFrom(TRACKS).where(TRACKS.PROCESSING_STATUS.eq(status)).fetch(this::toTrack);
    }

    /** Track IDs stuck in status since before threshold. */
    public List<UUID> findIdsByProcessingStatusAndCreatedAtBefore(String status, OffsetDateTime threshold) {
        return dsl.select(TRACKS.ID).from(TRACKS)
            .where(TRACKS.PROCESSING_STATUS.eq(status).and(TRACKS.CREATED_AT.lt(threshold)))
            .fetch(TRACKS.ID);
    }

    /** Find tracks by ISRC. */
    public List<Track> findByIsrc(String isrc) {
        return dsl.selectFrom(TRACKS).where(TRACKS.ISRC.eq(isrc)).fetch(this::toTrack);
    }

    public long countByIsrcNotNull() {
        return dsl.fetchCount(dsl.selectFrom(TRACKS).where(TRACKS.ISRC.isNotNull()));
    }

    public long countByIsrcStartingWith(String prefix) {
        return dsl.fetchCount(dsl.selectFrom(TRACKS).where(TRACKS.ISRC.like(prefix + "%")));
    }

    /** Find ISRCs that have multiple tracks. Returns list of [isrc, count]. */
    public List<Object[]> findDuplicateIsrcs(int limit, int offset) {
        return dsl.select(TRACKS.ISRC, DSL.count(TRACKS.ID).as("cnt"))
            .from(TRACKS)
            .where(TRACKS.ISRC.isNotNull())
            .groupBy(TRACKS.ISRC)
            .having(DSL.count(TRACKS.ID).gt(1))
            .orderBy(DSL.count(TRACKS.ID).desc())
            .limit(limit)
            .offset(offset)
            .fetch(r -> new Object[]{ r.get(TRACKS.ISRC), r.get(1, Long.class) });
    }

    private Track toTrack(Record r) {
        Double genreConf = r.get(TRACKS.GENRE_CONFIDENCE);
        List<Float> bars = parseJsonBToFloatList(r.get(TRACKS.BARS));
        List<Float> sections = parseJsonBToFloatList(r.get(TRACKS.SECTIONS));
        List<String> sectionLabels = parseJsonBToStringList(r.get(TRACKS.SECTION_LABELS));
        return Track.builder()
            .id(r.get(TRACKS.ID))
            .title(r.get(TRACKS.TITLE))
            .isrc(r.get(TRACKS.ISRC))
            .durationMs(r.get(TRACKS.DURATION_MS))
            .tempoBpm(r.get(TRACKS.TEMPO_BPM) != null ? r.get(TRACKS.TEMPO_BPM).floatValue() : null)
            .createdAt(r.get(TRACKS.CREATED_AT))
            .hasVocals(r.get(TRACKS.HAS_VOCALS))
            .swingRatio(r.get(TRACKS.SWING_RATIO) != null ? r.get(TRACKS.SWING_RATIO).floatValue() : null)
            .articulation(r.get(TRACKS.ARTICULATION) != null ? r.get(TRACKS.ARTICULATION).floatValue() : null)
            .bounciness(r.get(TRACKS.BOUNCINESS) != null ? r.get(TRACKS.BOUNCINESS).floatValue() : null)
            .loudness(r.get(TRACKS.LOUDNESS) != null ? r.get(TRACKS.LOUDNESS).floatValue() : null)
            .punchiness(r.get(TRACKS.PUNCHINESS) != null ? r.get(TRACKS.PUNCHINESS).floatValue() : null)
            .voiceProbability(r.get(TRACKS.VOICE_PROBABILITY) != null ? r.get(TRACKS.VOICE_PROBABILITY).floatValue() : null)
            .polskaScore(r.get(TRACKS.POLSKA_SCORE) != null ? r.get(TRACKS.POLSKA_SCORE).floatValue() : null)
            .hamboScore(r.get(TRACKS.HAMBO_SCORE) != null ? r.get(TRACKS.HAMBO_SCORE).floatValue() : null)
            .bpmStability(r.get(TRACKS.BPM_STABILITY) != null ? r.get(TRACKS.BPM_STABILITY).floatValue() : null)
            .isInstrumental(null)
            .analysisVersion(r.get(TRACKS.ANALYSIS_VERSION))
            .musicGenre(r.get(TRACKS.MUSIC_GENRE))
            .genreConfidence(genreConf != null ? genreConf.floatValue() : null)
            .isFlagged(r.get(TRACKS.IS_FLAGGED) != null && r.get(TRACKS.IS_FLAGGED))
            .flaggedAt(r.get(TRACKS.FLAGGED_AT))
            .flagReason(r.get(TRACKS.FLAG_REASON))
            .uploaderId(r.get(TRACKS.UPLOADER_ID))
            .processingStatus(r.get(TRACKS.PROCESSING_STATUS))
            .bars(bars)
            .sections(sections)
            .sectionLabels(sectionLabels)
            .build();
    }

    private List<Float> parseJsonBToFloatList(JSONB json) {
        if (json == null || json.data() == null) return null;
        try {
            List<Double> list = objectMapper.readValue(json.data(), LIST_DOUBLE);
            if (list == null) return null;
            return list.stream().map(d -> d.floatValue()).toList();
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> parseJsonBToStringList(JSONB json) {
        if (json == null || json.data() == null) return null;
        try {
            return objectMapper.readValue(json.data(), LIST_STRING);
        } catch (Exception e) {
            return null;
        }
    }
}
