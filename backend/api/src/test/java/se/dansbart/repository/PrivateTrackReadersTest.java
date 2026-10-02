package se.dansbart.repository;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import se.dansbart.domain.admin.folkwiki.FolkwikiMatchDto;
import se.dansbart.domain.admin.folkwiki.FolkwikiMatchJooqRepository;
import se.dansbart.domain.admin.track.AdminTrackDto;
import se.dansbart.domain.admin.track.AdminTrackJooqRepository;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.album.AlbumJooqRepository;
import se.dansbart.domain.analytics.TrackPlayback;
import se.dansbart.domain.analytics.TrackPlaybackJooqRepository;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.artist.ArtistJooqRepository;
import se.dansbart.domain.dance.Dance;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dance.DanceTrack;
import se.dansbart.domain.stats.StatsService;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackDanceStyleJooqRepository;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * A private track never appears in a reader outside the public lists of TrackJooqRepository.
 */
class PrivateTrackReadersTest extends AbstractRepositoryTest {

    private static final String STYLE = "polska";
    private static final String SHARED_ISRC = "SHARED0001";

    @Autowired
    private DSLContext dsl;

    @Autowired
    private TestDataFactory testData;

    @Autowired
    private TrackJooqRepository trackRepository;

    @Autowired
    private TrackDanceStyleJooqRepository danceStyleRepository;

    @Autowired
    private TrackPlaybackJooqRepository playbackRepository;

    @Autowired
    private StatsService statsService;

    @Autowired
    private ArtistJooqRepository artistRepository;

    @Autowired
    private AlbumJooqRepository albumRepository;

    @Autowired
    private DanceJooqRepository danceRepository;

    @Autowired
    private AdminTrackJooqRepository adminTrackRepository;

    @Autowired
    private FolkwikiMatchJooqRepository folkwikiRepository;

    private Track seedTrack(String title, String status, boolean isPrivate, String isrc, Artist artist, Album album) {
        var builder = testData.track().withTitle(title).withArtist(artist).withDanceStyle(STYLE);
        Track track = (isrc == null ? builder : builder.withIsrc(isrc)).build();
        testData.addTrackToAlbum(album, track);
        dsl.execute("update tracks set processing_status = ?, is_private = ?, created_at = now() - interval '2 days' where id = ?",
                status, isPrivate, track.getId());
        return track;
    }

    private static void assertVisible(String method, List<UUID> listed, Track publicTrack, Track privateTrack) {
        assertThat(listed).as(method + " lists the public track").contains(publicTrack.getId());
        assertThat(listed).as(method + " lists the private track").doesNotContain(privateTrack.getId());
    }

    private static long number(Object value) {
        return ((Number) value).longValue();
    }

    @Test
    void statsAndCountsIgnorePrivateTracks() {
        Artist artist = testData.artist().build();
        Album album = testData.album().withArtist(artist).build();
        Track publicTrack = seedTrack("Stats Public", "DONE", false, null, artist, album);
        Track privateTrack = seedTrack("Stats Private", "DONE", true, null, artist, album);
        for (Track track : List.of(publicTrack, privateTrack)) {
            playbackRepository.insert(TrackPlayback.builder()
                    .trackId(track.getId()).platform("spotify").durationSeconds(100).build());
        }
        flush();

        var stats = statsService.getLibraryStats();
        List<UUID> played = playbackRepository.findMostPlayedTracks(null, 50).stream()
                .map(row -> (UUID) row[0]).toList();

        assertAll(
                () -> assertEquals(1L, stats.getTotalTracks(), "getLibraryStats totalTracks counts the private track"),
                () -> assertEquals(1L, stats.getClassified(), "getLibraryStats classified counts the private track"),
                () -> assertEquals(1L, danceStyleRepository.countDistinctTracksByDanceStyle(STYLE),
                        "countDistinctTracksByDanceStyle counts the private track"),
                () -> assertVisible("findMostPlayedTracks", played, publicTrack, privateTrack),
                () -> assertEquals(100L, playbackRepository.sumDurationSeconds(null),
                        "sumDurationSeconds sums the private track"),
                () -> assertEquals(1L, number(playbackRepository.countByPlatform(null).get(0)[1]),
                        "countByPlatform counts the private track"));
    }

    @Test
    void artistAndAlbumPagesIgnorePrivateTracks() {
        Artist artist = testData.artist().build();
        Album album = testData.album().withArtist(artist).build();
        Track publicTrack = seedTrack("Page Public", "PENDING", false, null, artist, album);
        Track privateTrack = seedTrack("Page Private", "PENDING", true, null, artist, album);
        flush();

        List<UUID> artistIds = List.of(artist.getId());
        List<UUID> albumIds = List.of(album.getId());

        assertAll(
                () -> assertEquals(1L, artistRepository.findTrackCountByArtistIds(artistIds).get(artist.getId()),
                        "findTrackCountByArtistIds counts the private track"),
                () -> assertEquals(1L, number(artistRepository.countPendingTracksByArtistIds(artistIds).get(0)[1]),
                        "countPendingTracksByArtistIds counts the private track"),
                () -> assertVisible("getTrackIdsByArtistId",
                        artistRepository.getTrackIdsByArtistId(artist.getId()), publicTrack, privateTrack),
                () -> assertEquals(1L, albumRepository.findTrackCountByAlbumIds(albumIds).get(album.getId()),
                        "findTrackCountByAlbumIds counts the private track"),
                () -> assertEquals(1L, number(albumRepository.countPendingTracksByAlbumIds(albumIds).get(0)[1]),
                        "countPendingTracksByAlbumIds counts the private track"));
    }

    @Test
    void dancePagesIgnorePrivateTracks() {
        Artist artist = testData.artist().build();
        Album album = testData.album().withArtist(artist).build();
        Track publicTrack = seedTrack("Dance Public", "DONE", false, null, artist, album);
        Track privateTrack = seedTrack("Dance Private", "DONE", true, null, artist, album);
        Dance dance = testData.dance().withName("Zzz").withSlug("zzz").withDanceType(STYLE).build();
        danceRepository.addTrackConfirmed(dance.getId(), publicTrack.getId(), null);
        danceRepository.addTrackConfirmed(dance.getId(), privateTrack.getId(), null);
        flush();

        List<UUID> confirmed = danceRepository.findConfirmedTracksByDanceId(dance.getId()).stream()
                .map(DanceTrack::getTrackId).toList();
        UUID otherDance = testData.dance().withName("Yyy").withSlug("yyy").withDanceType(STYLE).build().getId();

        assertAll(
                () -> assertVisible("findConfirmedTracksByDanceId", confirmed, publicTrack, privateTrack),
                () -> assertEquals(1L, danceRepository.countConfirmedTracksByDanceId(dance.getId()),
                        "countConfirmedTracksByDanceId counts the private track"),
                () -> assertEquals(1, danceRepository.countConfirmedByDanceIds(List.of(dance.getId()))
                        .get(dance.getId()), "countConfirmedByDanceIds counts the private track"),
                () -> assertVisible("findRecommendedTrackIds",
                        danceRepository.findRecommendedTrackIds(otherDance, STYLE, "Yyy", null, 50, 0, List.of()),
                        publicTrack, privateTrack),
                () -> assertEquals(1L,
                        danceRepository.countRecommendedTracks(otherDance, STYLE, "Yyy", null, List.of()),
                        "countRecommendedTracks counts the private track"),
                () -> assertVisible("findTrackIdsByTitleFragment",
                        danceRepository.findTrackIdsByTitleFragment("dance"), publicTrack, privateTrack));
    }

    @Test
    void adminAndMaintenanceSkipPrivateTracks() {
        Artist artist = testData.artist().build();
        Album album = testData.album().withArtist(artist).build();
        Track publicDone = seedTrack("Admin Public", "DONE", false, null, artist, album);
        Track privateDone = seedTrack("Admin Private", "DONE", true, null, artist, album);
        Track publicStuck = seedTrack("Stuck Public", "PROCESSING", false, SHARED_ISRC, artist, album);
        Track privateStuck = seedTrack("Stuck Private", "PROCESSING", true, SHARED_ISRC, artist, album);
        Dance dance = testData.dance().withName("Admin Dance").withSlug("admin-dance").build();
        danceRepository.addTrack(dance.getId(), publicDone.getId(), null);
        danceRepository.addTrack(dance.getId(), privateDone.getId(), null);
        int tuneId = dsl.fetchOne("insert into folkwiki_tunes (folkwiki_id, title, normalized_title, folkwiki_url)"
                + " values ('t1', 'Tune', 'tune', 'u') returning id").get(0, Integer.class);
        dsl.execute("insert into folkwiki_tunes (folkwiki_id, title, normalized_title, folkwiki_url)"
                + " values ('t2', 'Admin', 'admin', 'u')");
        for (Track track : List.of(publicDone, privateDone)) {
            dsl.execute("insert into track_folkwiki_matches (track_id, folkwiki_tune_id, match_type) values (?, ?, 'exact')",
                    track.getId(), tuneId);
        }
        flush();

        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(1);
        List<UUID> library = adminTrackRepository.findAllWithRelationships(null, null, null, 50, 0, null, null)
                .getContent().stream().map(AdminTrackDto::id).toList();
        List<UUID> matched = folkwikiRepository.findByStatus("pending", 50, 0).stream()
                .map(FolkwikiMatchDto::trackId).toList();
        List<UUID> pendingLinks = danceRepository.findPendingLinks(PageRequest.of(0, 50)).stream()
                .map(DanceTrack::getTrackId).toList();
        List<UUID> primaryStyled = folkwikiRepository.findAllPrimaryTrackStyles().stream()
                .map(row -> UUID.fromString(row.get("trackId"))).toList();
        Map<String, Long> statusCounts = adminTrackRepository.countByProcessingStatus();

        assertAll(
                () -> assertVisible("findAllWithRelationships", library, publicDone, privateDone),
                () -> assertEquals(2L, adminTrackRepository.findAllWithRelationships(
                        null, null, null, 50, 0, null, null).getTotalElements(),
                        "findAllWithRelationships total counts the private track"),
                () -> assertEquals(1L, statusCounts.get("DONE"), "countByProcessingStatus counts the private track"),
                () -> assertVisible("findPendingLinks", pendingLinks, publicDone, privateDone),
                () -> assertVisible("findByStatus", matched, publicDone, privateDone),
                () -> assertEquals(1, folkwikiRepository.countByStatus("pending"),
                        "countByStatus counts the private track"),
                () -> assertVisible("findAllPrimaryTrackStyles", primaryStyled, publicDone, privateDone),
                () -> assertVisible("findByProcessingStatus",
                        trackRepository.findByProcessingStatus("PROCESSING").stream().map(Track::getId).toList(),
                        publicStuck, privateStuck),
                () -> assertVisible("findIdsByProcessingStatusOrderByCreatedAtAsc",
                        trackRepository.findIdsByProcessingStatusOrderByCreatedAtAsc("PROCESSING", 50),
                        publicStuck, privateStuck),
                () -> assertVisible("findIdsByProcessingStatusAndCreatedAtBefore",
                        trackRepository.findIdsByProcessingStatusAndCreatedAtBefore("PROCESSING", cutoff),
                        publicStuck, privateStuck),
                () -> assertVisible("findByIsrc",
                        trackRepository.findByIsrc(SHARED_ISRC).stream().map(Track::getId).toList(),
                        publicStuck, privateStuck),
                () -> assertEquals(2L, trackRepository.countByIsrcNotNull(),
                        "countByIsrcNotNull counts the private track"),
                () -> assertEquals(1L, trackRepository.countByIsrcStartingWith("SHARED"),
                        "countByIsrcStartingWith counts the private track"),
                () -> assertThat(trackRepository.findDuplicateIsrcs(50, 0))
                        .as("findDuplicateIsrcs reports an ISRC that one public track holds")
                        .isEmpty(),
                () -> assertEquals(1, folkwikiRepository.runMatching(),
                        "runMatching matches the private track"));
    }
}
