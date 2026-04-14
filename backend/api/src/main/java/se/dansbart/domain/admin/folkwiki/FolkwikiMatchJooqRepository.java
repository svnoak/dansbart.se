package se.dansbart.domain.admin.folkwiki;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import se.dansbart.dto.PlaybackLinkDto;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static se.dansbart.jooq.Tables.*;

@Repository
@RequiredArgsConstructor
public class FolkwikiMatchJooqRepository {

    private final DSLContext dsl;

    public List<FolkwikiMatchDto> findByStatus(String status, int limit, int offset) {
        var ft = FOLKWIKI_TUNES;
        var tfm = TRACK_FOLKWIKI_MATCHES;
        var t = TRACKS;
        var tds = TRACK_DANCE_STYLES;

        var condition = status != null && !status.isEmpty()
            ? tfm.MATCH_STATUS.eq(status)
            : org.jooq.impl.DSL.trueCondition();

        var rows = dsl.select(
                t.ID,
                t.TITLE,
                tds.DANCE_STYLE,
                tds.SUB_STYLE,
                tds.CONFIDENCE,
                tds.CLASSIFICATION_SOURCE,
                ft.ID.as("folkwiki_tune_id"),
                ft.FOLKWIKI_ID,
                ft.TITLE.as("folkwiki_title"),
                ft.STYLE.as("folkwiki_style"),
                ft.METER.as("folkwiki_meter"),
                ft.BEATS_PER_BAR.as("folkwiki_bpb"),
                ft.FOLKWIKI_URL,
                tfm.MATCH_TYPE,
                tfm.MATCH_STATUS,
                tfm.CREATED_AT
            )
            .from(tfm)
            .join(t).on(t.ID.eq(tfm.TRACK_ID))
            .join(ft).on(ft.ID.eq(tfm.FOLKWIKI_TUNE_ID))
            .leftJoin(tds).on(tds.TRACK_ID.eq(t.ID).and(tds.IS_PRIMARY.eq(true)))
            .where(condition)
            .orderBy(t.TITLE.asc())
            .limit(limit)
            .offset(offset)
            .fetch();

        Set<UUID> trackIds = rows.stream()
            .map(r -> r.get(t.ID))
            .collect(Collectors.toSet());

        Map<UUID, List<PlaybackLinkDto>> playbacksByTrack = new HashMap<>();
        if (!trackIds.isEmpty()) {
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
        }

        return rows.stream()
            .map(r -> toDto(r, playbacksByTrack.getOrDefault(r.get(t.ID), List.of())))
            .toList();
    }

    public int countByStatus(String status) {
        var condition = status != null && !status.isEmpty()
            ? TRACK_FOLKWIKI_MATCHES.MATCH_STATUS.eq(status)
            : org.jooq.impl.DSL.trueCondition();

        return dsl.selectCount()
            .from(TRACK_FOLKWIKI_MATCHES)
            .where(condition)
            .fetchOne(0, int.class);
    }

    public boolean updateStatus(UUID trackId, int folkwikiTuneId, String status, String confirmedBy) {
        int rows = dsl.update(TRACK_FOLKWIKI_MATCHES)
            .set(TRACK_FOLKWIKI_MATCHES.MATCH_STATUS, status)
            .set(TRACK_FOLKWIKI_MATCHES.CONFIRMED_BY, confirmedBy)
            .set(TRACK_FOLKWIKI_MATCHES.CONFIRMED_AT, OffsetDateTime.now())
            .where(TRACK_FOLKWIKI_MATCHES.TRACK_ID.eq(trackId)
                .and(TRACK_FOLKWIKI_MATCHES.FOLKWIKI_TUNE_ID.eq(folkwikiTuneId)))
            .execute();
        return rows > 0;
    }

    public String getFolkwikiStyle(int folkwikiTuneId) {
        return dsl.select(FOLKWIKI_TUNES.STYLE)
            .from(FOLKWIKI_TUNES)
            .where(FOLKWIKI_TUNES.ID.eq(folkwikiTuneId))
            .fetchOneInto(String.class);
    }

    public List<Map<String, String>> findAllPrimaryTrackStyles() {
        return dsl.select(
                TRACK_DANCE_STYLES.TRACK_ID,
                TRACK_DANCE_STYLES.DANCE_STYLE,
                TRACK_DANCE_STYLES.SUB_STYLE
            )
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true))
            .fetch()
            .stream()
            .map(r -> {
                Map<String, String> row = new java.util.HashMap<>();
                row.put("trackId", r.get(TRACK_DANCE_STYLES.TRACK_ID).toString());
                row.put("danceStyle", r.get(TRACK_DANCE_STYLES.DANCE_STYLE));
                row.put("subStyle", r.get(TRACK_DANCE_STYLES.SUB_STYLE));
                return row;
            })
            .toList();
    }

    public boolean updateTuneStyle(int folkwikiTuneId, String style) {
        int rows = dsl.update(FOLKWIKI_TUNES)
            .set(FOLKWIKI_TUNES.STYLE, style)
            .set(FOLKWIKI_TUNES.UPDATED_AT, OffsetDateTime.now())
            .where(FOLKWIKI_TUNES.ID.eq(folkwikiTuneId))
            .execute();
        return rows > 0;
    }

    public void updateTrackClassification(UUID trackId, String danceStyle) {
        var existing = dsl.select(TRACK_DANCE_STYLES.ID)
            .from(TRACK_DANCE_STYLES)
            .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)
                .and(TRACK_DANCE_STYLES.IS_PRIMARY.eq(true)))
            .fetchOne();

        if (existing != null) {
            dsl.update(TRACK_DANCE_STYLES)
                .set(TRACK_DANCE_STYLES.DANCE_STYLE, danceStyle)
                .set(TRACK_DANCE_STYLES.IS_USER_CONFIRMED, true)
                .set(TRACK_DANCE_STYLES.CONFIDENCE, 1.0)
                .set(TRACK_DANCE_STYLES.CLASSIFICATION_SOURCE, "folkwiki")
                .where(TRACK_DANCE_STYLES.ID.eq(existing.get(TRACK_DANCE_STYLES.ID)))
                .execute();
        } else {
            dsl.insertInto(TRACK_DANCE_STYLES)
                .columns(
                    TRACK_DANCE_STYLES.ID,
                    TRACK_DANCE_STYLES.TRACK_ID,
                    TRACK_DANCE_STYLES.DANCE_STYLE,
                    TRACK_DANCE_STYLES.IS_PRIMARY,
                    TRACK_DANCE_STYLES.CONFIDENCE,
                    TRACK_DANCE_STYLES.BPM_MULTIPLIER,
                    TRACK_DANCE_STYLES.EFFECTIVE_BPM,
                    TRACK_DANCE_STYLES.CONFIRMATION_COUNT,
                    TRACK_DANCE_STYLES.IS_USER_CONFIRMED,
                    TRACK_DANCE_STYLES.CLASSIFICATION_SOURCE
                )
                .values(
                    UUID.randomUUID(),
                    trackId,
                    danceStyle,
                    true,
                    1.0,
                    1.0,
                    0,
                    0,
                    true,
                    "folkwiki"
                )
                .execute();
        }
    }

    // --- Import & matching ---

    private static final Pattern PARENS = Pattern.compile("\\s*\\([^)]*\\)");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern TRAILING_PUNCT = Pattern.compile("[.,;:!?]+$");
    private static final String BOUNDARY = "(?:^|[\\s\\-,;:/])";
    private static final String BOUNDARY_END = "(?:$|[\\s\\-,;:/])";

    private static String normalize(String name) {
        String s = name.strip().toLowerCase();
        s = PARENS.matcher(s).replaceAll("");
        s = WHITESPACE.matcher(s).replaceAll(" ").strip();
        s = TRAILING_PUNCT.matcher(s).replaceAll("");
        return s;
    }

    /**
     * Upsert folkwiki tunes from import data. Returns count of newly inserted tunes.
     */
    public int upsertTunes(List<FolkwikiTuneImport> tunes) {
        int inserted = 0;
        for (var tune : tunes) {
            String folkwikiUrl = tune.folkwikiId().matches("\\d+")
                ? "http://www.folkwiki.se/Musik/" + tune.folkwikiId()
                : "http://www.folkwiki.se/Musik/" + tune.folkwikiId();

            int rows = dsl.insertInto(FOLKWIKI_TUNES)
                .columns(
                    FOLKWIKI_TUNES.FOLKWIKI_ID,
                    FOLKWIKI_TUNES.TITLE,
                    FOLKWIKI_TUNES.NORMALIZED_TITLE,
                    FOLKWIKI_TUNES.STYLE,
                    FOLKWIKI_TUNES.METER,
                    FOLKWIKI_TUNES.BEATS_PER_BAR,
                    FOLKWIKI_TUNES.FOLKWIKI_URL
                )
                .values(
                    tune.folkwikiId(),
                    tune.title(),
                    tune.normalizedTitle(),
                    tune.configStyle(),
                    tune.meter(),
                    tune.beatsPerBar(),
                    folkwikiUrl
                )
                .onConflict(FOLKWIKI_TUNES.FOLKWIKI_ID)
                .doUpdate()
                .set(FOLKWIKI_TUNES.TITLE, tune.title())
                .set(FOLKWIKI_TUNES.NORMALIZED_TITLE, tune.normalizedTitle())
                .set(FOLKWIKI_TUNES.STYLE, tune.configStyle())
                .set(FOLKWIKI_TUNES.METER, tune.meter())
                .set(FOLKWIKI_TUNES.BEATS_PER_BAR, tune.beatsPerBar())
                .set(FOLKWIKI_TUNES.UPDATED_AT, OffsetDateTime.now())
                .execute();
            if (rows > 0) inserted++;
        }
        return inserted;
    }

    /**
     * Run matching between folkwiki tunes and DB tracks.
     * Uses the same logic as the Python match script: exact normalized match first,
     * then word-boundary substring match (excluding style-name entries).
     * Returns count of new matches created.
     */
    public int runMatching() {
        // Load all folkwiki tunes
        var allTunes = dsl.select(
                FOLKWIKI_TUNES.ID,
                FOLKWIKI_TUNES.NORMALIZED_TITLE,
                FOLKWIKI_TUNES.STYLE
            )
            .from(FOLKWIKI_TUNES)
            .fetch();

        // Build index: normalized_title -> list of (id, style)
        Map<String, List<Integer>> exactIndex = new HashMap<>();
        for (var r : allTunes) {
            String norm = normalize(r.get(FOLKWIKI_TUNES.NORMALIZED_TITLE));
            exactIndex.computeIfAbsent(norm, k -> new ArrayList<>())
                .add(r.get(FOLKWIKI_TUNES.ID));
        }

        // Collect all style names for exclusion
        Set<String> styleNames = allTunes.stream()
            .map(r -> r.get(FOLKWIKI_TUNES.STYLE))
            .filter(Objects::nonNull)
            .map(s -> normalize(s))
            .collect(Collectors.toSet());

        // Pre-compile word-boundary patterns for substring matching
        record FwPattern(Pattern pattern, int tuneId) {}
        List<FwPattern> substringPatterns = new ArrayList<>();
        for (var r : allTunes) {
            String norm = normalize(r.get(FOLKWIKI_TUNES.NORMALIZED_TITLE));
            if (norm.length() >= 4 && !styleNames.contains(norm)) {
                Pattern p = Pattern.compile(
                    BOUNDARY + Pattern.quote(norm) + BOUNDARY_END);
                substringPatterns.add(new FwPattern(p, r.get(FOLKWIKI_TUNES.ID)));
            }
        }

        // Load all DONE tracks
        var tracks = dsl.select(TRACKS.ID, TRACKS.TITLE)
            .from(TRACKS)
            .where(TRACKS.PROCESSING_STATUS.eq("DONE"))
            .fetch();

        // Load existing matches to avoid duplicates
        Set<String> existingMatches = dsl.select(
                TRACK_FOLKWIKI_MATCHES.TRACK_ID,
                TRACK_FOLKWIKI_MATCHES.FOLKWIKI_TUNE_ID
            )
            .from(TRACK_FOLKWIKI_MATCHES)
            .fetch()
            .stream()
            .map(r -> r.get(TRACK_FOLKWIKI_MATCHES.TRACK_ID) + ":" +
                       r.get(TRACK_FOLKWIKI_MATCHES.FOLKWIKI_TUNE_ID))
            .collect(Collectors.toSet());

        int newMatches = 0;
        for (var track : tracks) {
            UUID trackId = track.get(TRACKS.ID);
            String trackNorm = normalize(track.get(TRACKS.TITLE));

            // 1. Exact match
            List<Integer> exactHits = exactIndex.get(trackNorm);
            if (exactHits != null) {
                for (int tuneId : exactHits) {
                    String key = trackId + ":" + tuneId;
                    if (!existingMatches.contains(key)) {
                        insertMatch(trackId, tuneId, "exact");
                        existingMatches.add(key);
                        newMatches++;
                    }
                }
                continue;
            }

            // 2. Substring match (first hit only)
            for (var fp : substringPatterns) {
                if (fp.pattern().matcher(trackNorm).find()) {
                    String key = trackId + ":" + fp.tuneId();
                    if (!existingMatches.contains(key)) {
                        insertMatch(trackId, fp.tuneId(), "contains");
                        existingMatches.add(key);
                        newMatches++;
                    }
                    break;
                }
            }
        }

        return newMatches;
    }

    private void insertMatch(UUID trackId, int folkwikiTuneId, String matchType) {
        dsl.insertInto(TRACK_FOLKWIKI_MATCHES)
            .columns(
                TRACK_FOLKWIKI_MATCHES.TRACK_ID,
                TRACK_FOLKWIKI_MATCHES.FOLKWIKI_TUNE_ID,
                TRACK_FOLKWIKI_MATCHES.MATCH_TYPE,
                TRACK_FOLKWIKI_MATCHES.MATCH_STATUS
            )
            .values(trackId, folkwikiTuneId, matchType, "pending")
            .onConflict(TRACK_FOLKWIKI_MATCHES.TRACK_ID, TRACK_FOLKWIKI_MATCHES.FOLKWIKI_TUNE_ID)
            .doNothing()
            .execute();
    }

    private FolkwikiMatchDto toDto(Record r, List<PlaybackLinkDto> playbackLinks) {
        return new FolkwikiMatchDto(
            r.get(TRACKS.ID),
            r.get(TRACKS.TITLE),
            r.get(TRACK_DANCE_STYLES.DANCE_STYLE),
            r.get(TRACK_DANCE_STYLES.SUB_STYLE),
            r.get(TRACK_DANCE_STYLES.CONFIDENCE) != null
                ? r.get(TRACK_DANCE_STYLES.CONFIDENCE).floatValue() : null,
            r.get(TRACK_DANCE_STYLES.CLASSIFICATION_SOURCE),
            r.get("folkwiki_tune_id", Integer.class),
            r.get(FOLKWIKI_TUNES.FOLKWIKI_ID),
            r.get("folkwiki_title", String.class),
            r.get("folkwiki_style", String.class),
            r.get("folkwiki_meter", String.class),
            r.get("folkwiki_bpb", Integer.class),
            r.get(FOLKWIKI_TUNES.FOLKWIKI_URL),
            r.get(TRACK_FOLKWIKI_MATCHES.MATCH_TYPE),
            r.get(TRACK_FOLKWIKI_MATCHES.MATCH_STATUS),
            playbackLinks
        );
    }
}
