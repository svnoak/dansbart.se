package se.dansbart.domain.admin.track;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;
import se.dansbart.dto.AlbumSummaryDto;
import se.dansbart.dto.ArtistSummaryDto;
import se.dansbart.dto.PlaybackLinkDto;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

import static org.jooq.impl.DSL.count;
import static se.dansbart.jooq.Tables.*;

/**
 * JOOQ repository for admin track queries with relationships.
 */
@Repository
public class AdminTrackJooqRepository {

    private final DSLContext dsl;

    public AdminTrackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Page<AdminTrackDto> findAllWithRelationships(String search, String status, Boolean flagged, int limit, int offset) {
        // Build base conditions
        var conditions = new ArrayList<org.jooq.Condition>();

        if (search != null && !search.isBlank()) {
            conditions.add(TRACKS.TITLE.likeIgnoreCase("%" + search + "%"));
        }
        if (status != null && !status.isBlank()) {
            conditions.add(TRACKS.PROCESSING_STATUS.eq(status));
        }
        if (flagged != null) {
            conditions.add(TRACKS.IS_FLAGGED.eq(flagged));
        }

        var whereClause = conditions.isEmpty()
            ? org.jooq.impl.DSL.trueCondition()
            : org.jooq.impl.DSL.and(conditions);

        // Get track IDs with pagination
        List<UUID> trackIds = dsl.select(TRACKS.ID)
            .from(TRACKS)
            .where(whereClause)
            .orderBy(TRACKS.CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch(TRACKS.ID);

        if (trackIds.isEmpty()) {
            return new PageImpl<>(List.of(), PageRequest.of(offset / limit, limit), 0);
        }

        // Fetch tracks - store raw data in a map
        Map<UUID, Record> trackRecords = new LinkedHashMap<>();
        dsl.selectFrom(TRACKS)
            .where(TRACKS.ID.in(trackIds))
            .orderBy(TRACKS.CREATED_AT.desc())
            .forEach(r -> trackRecords.put(r.get(TRACKS.ID), r));

        // Fetch artists for all tracks
        Map<UUID, List<ArtistSummaryDto>> artistsByTrack = new HashMap<>();
        dsl.select(TRACK_ARTISTS.TRACK_ID, TRACK_ARTISTS.ROLE, ARTISTS.ID, ARTISTS.NAME, ARTISTS.IMAGE_URL)
            .from(TRACK_ARTISTS)
            .join(ARTISTS).on(TRACK_ARTISTS.ARTIST_ID.eq(ARTISTS.ID))
            .where(TRACK_ARTISTS.TRACK_ID.in(trackIds))
            .forEach(r -> {
                UUID trackId = r.get(TRACK_ARTISTS.TRACK_ID);
                artistsByTrack.computeIfAbsent(trackId, k -> new ArrayList<>()).add(
                    ArtistSummaryDto.builder()
                        .id(r.get(ARTISTS.ID))
                        .name(r.get(ARTISTS.NAME))
                        .imageUrl(r.get(ARTISTS.IMAGE_URL))
                        .role(r.get(TRACK_ARTISTS.ROLE))
                        .build()
                );
            });

        // Fetch albums for all tracks (first album per track)
        Map<UUID, AlbumSummaryDto> albumByTrack = new HashMap<>();
        dsl.select(TRACK_ALBUMS.TRACK_ID, ALBUMS.ID, ALBUMS.TITLE, ALBUMS.COVER_IMAGE_URL, ALBUMS.RELEASE_DATE)
            .from(TRACK_ALBUMS)
            .join(ALBUMS).on(TRACK_ALBUMS.ALBUM_ID.eq(ALBUMS.ID))
            .where(TRACK_ALBUMS.TRACK_ID.in(trackIds))
            .forEach(r -> {
                UUID trackId = r.get(TRACK_ALBUMS.TRACK_ID);
                if (!albumByTrack.containsKey(trackId)) {
                    albumByTrack.put(trackId, AlbumSummaryDto.builder()
                        .id(r.get(ALBUMS.ID))
                        .title(r.get(ALBUMS.TITLE))
                        .coverImageUrl(r.get(ALBUMS.COVER_IMAGE_URL))
                        .releaseDate(r.get(ALBUMS.RELEASE_DATE))
                        .build()
                    );
                }
            });

        // Fetch playback links for all tracks
        Map<UUID, List<PlaybackLinkDto>> playbacksByTrack = new HashMap<>();
        dsl.selectFrom(PLAYBACK_LINKS)
            .where(PLAYBACK_LINKS.TRACK_ID.in(trackIds))
            .forEach(r -> {
                UUID trackId = r.get(PLAYBACK_LINKS.TRACK_ID);
                playbacksByTrack.computeIfAbsent(trackId, k -> new ArrayList<>()).add(
                    PlaybackLinkDto.builder()
                        .id(r.get(PLAYBACK_LINKS.ID))
                        .platform(r.get(PLAYBACK_LINKS.PLATFORM))
                        .deepLink(r.get(PLAYBACK_LINKS.DEEP_LINK))
                        .isWorking(r.get(PLAYBACK_LINKS.IS_WORKING))
                        .build()
                );
            });

        // Fetch primary dance style per track (one row per track where is_primary = true)
        Map<UUID, PrimaryStyleInfo> primaryStyleByTrack = new HashMap<>();
        dsl.select(
                TRACK_DANCE_STYLES.TRACK_ID,
                TRACK_DANCE_STYLES.DANCE_STYLE,
                TRACK_DANCE_STYLES.SUB_STYLE,
                TRACK_DANCE_STYLES.TEMPO_CATEGORY,
                TRACK_DANCE_STYLES.CONFIDENCE)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.in(trackIds)
                .and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true)))
            .forEach(r -> {
                UUID trackId = r.get(TRACK_DANCE_STYLES.TRACK_ID);
                if (!primaryStyleByTrack.containsKey(trackId)) {
                    Double conf = r.get(TRACK_DANCE_STYLES.CONFIDENCE);
                    primaryStyleByTrack.put(trackId, new PrimaryStyleInfo(
                        r.get(TRACK_DANCE_STYLES.DANCE_STYLE),
                        r.get(TRACK_DANCE_STYLES.SUB_STYLE),
                        r.get(TRACK_DANCE_STYLES.TEMPO_CATEGORY),
                        conf != null ? conf.floatValue() : null));
                }
            });

        // Build final DTOs
        List<AdminTrackDto> tracks = trackRecords.entrySet().stream()
            .map(entry -> {
                UUID id = entry.getKey();
                Record r = entry.getValue();
                Double genreConfidence = r.get(TRACKS.GENRE_CONFIDENCE);

                PrimaryStyleInfo style = primaryStyleByTrack.get(id);
                return new AdminTrackDto(
                    id,
                    r.get(TRACKS.TITLE),
                    r.get(TRACKS.ISRC),
                    r.get(TRACKS.DURATION_MS),
                    r.get(TRACKS.TEMPO_BPM) != null ? r.get(TRACKS.TEMPO_BPM).floatValue() : null,
                    r.get(TRACKS.CREATED_AT),
                    r.get(TRACKS.PROCESSING_STATUS),
                    r.get(TRACKS.IS_FLAGGED),
                    r.get(TRACKS.FLAG_REASON),
                    r.get(TRACKS.HAS_VOCALS),
                    r.get(TRACKS.MUSIC_GENRE),
                    genreConfidence != null ? genreConfidence.floatValue() : null,
                    artistsByTrack.getOrDefault(id, List.of()),
                    albumByTrack.get(id),
                    playbacksByTrack.getOrDefault(id, List.of()),
                    style != null ? style.danceStyle() : null,
                    style != null ? style.subStyle() : null,
                    style != null ? style.tempoCategory() : null,
                    style != null ? style.confidence() : null
                );
            })
            .collect(Collectors.toList());

        // Get total count
        long total = dsl.fetchCount(dsl.selectFrom(TRACKS).where(whereClause));

        return new PageImpl<>(tracks, PageRequest.of(offset / limit, limit), total);
    }

    public Map<String, Long> countByProcessingStatus() {
        return dsl.select(TRACKS.PROCESSING_STATUS, count())
            .from(TRACKS)
            .groupBy(TRACKS.PROCESSING_STATUS)
            .fetchStream()
            .collect(Collectors.toMap(
                r -> r.get(TRACKS.PROCESSING_STATUS),
                r -> ((Number) r.get(count())).longValue()
            ));
    }

    private record PrimaryStyleInfo(String danceStyle, String subStyle, String tempoCategory, Float confidence) {}
}
