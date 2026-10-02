package se.dansbart.repository;

import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import se.dansbart.domain.album.Album;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * A private track never appears in a public list of TrackJooqRepository.
 */
class PrivateTrackExclusionTest extends AbstractRepositoryTest {

    private static final Set<String> FILTERED = Set.of(
            "searchByTitle",
            "findByArtistId",
            "findByAlbumId",
            "findSimilarTracks",
            "findPlayableTracksWithFilters",
            "countPlayableTracksWithFilters",
            "findClassifyQueueTrackIds",
            "findRecentVerifiedTracks",
            "findCuratedTracks",
            "findFallbackTracks",
            "findStyleCounts",
            "findSubStylesForStyle",
            "findByStyleWithConfidence",
            "findByStylesWithConfidence",
            "findInstrumentalTracks",
            "findSlowTracks",
            "findFastTracks",
            "findBeginnerFriendlyByStyle",
            "findAllOrderByCreatedAt",
            "countTracks",
            "countTracksWithAnalysis",
            "findByProcessingStatus",
            "findIdsByProcessingStatusOrderByCreatedAtAsc",
            "findIdsByProcessingStatusAndCreatedAtBefore",
            "findByIsrc",
            "countByIsrcNotNull",
            "countByIsrcStartingWith",
            "findDuplicateIsrcs");

    private static final Set<String> UNFILTERED = Set.of(
            "findById",
            "insert",
            "insertTrackArtist",
            "existsById",
            "findByIds",
            "findTrackListDtosByIds",
            "findTrackIdsWithSecondaryStyle",
            "setProcessingStatus",
            "deleteWithRelations",
            "deleteById",
            "deleteAllById",
            "setProcessingStatusBatch",
            "updateTrack",
            "findIdsByProcessingStatusOrderByCreatedAtDesc",
            "findIdsOrderByCreatedAtDesc",
            "findIdsWhereProcessingStatusNotDone",
            "countPrivateTracks");

    private static final String STYLE = "polska";
    private static final String PUBLIC_SUB_STYLE = "slangpolska";
    private static final String PRIVATE_SUB_STYLE = "private-only";

    @Autowired
    private TrackJooqRepository trackRepository;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private TestDataFactory testData;

    private Track seedPlayableTrack(String title, Artist artist, Album album) {
        Track track = testData.track()
                .withTitle(title)
                .withArtist(artist)
                .withDanceStyle(STYLE)
                .withEffectiveBpm(120)
                .withHasVocals(false)
                .withBounciness(0.5f)
                .withArticulation(0.5f)
                .complete()
                .build();
        testData.addTrackToAlbum(album, track);
        dsl.execute("update track_dance_styles set confidence = 1.0 where track_id = ?", track.getId());
        dsl.execute("update tracks set analysis_version = 'test', embedding = ?::vector where id = ?",
                "[1,0,0]", track.getId());
        return track;
    }

    private static List<UUID> ids(List<Track> tracks) {
        return tracks.stream().map(Track::getId).toList();
    }

    private static void assertListing(String method, List<UUID> listed, UUID publicId, UUID privateId) {
        assertThat(listed).as(method + " lists the public track").contains(publicId);
        assertThat(listed).as(method + " lists the private track").doesNotContain(privateId);
    }

    @Test
    void everyPublicTrackListingExcludesPrivateTracks() {
        Artist artist = testData.artist().build();
        Album album = testData.album().withArtist(artist).build();
        Track reference = seedPlayableTrack("Reference", artist, album);
        Track publicTrack = seedPlayableTrack("Public", artist, album);
        Track privateTrack = seedPlayableTrack("Private", artist, album);
        dsl.execute("update tracks set is_private = true where id = ?", privateTrack.getId());
        dsl.execute("update track_dance_styles set sub_style = ? where track_id = ?",
                PUBLIC_SUB_STYLE, publicTrack.getId());
        dsl.execute("update track_dance_styles set sub_style = ? where track_id = ?",
                PRIVATE_SUB_STYLE, privateTrack.getId());
        flush();

        UUID pub = publicTrack.getId();
        UUID priv = privateTrack.getId();
        long baselineTotal = 2;

        assertAll(
                () -> assertListing("searchByTitle",
                        ids(trackRepository.searchByTitle("", PageRequest.of(0, 50)).getContent()), pub, priv),
                () -> assertEquals(baselineTotal,
                        trackRepository.searchByTitle("", PageRequest.of(0, 50)).getTotalElements(),
                        "searchByTitle total counts the private track"),
                () -> assertListing("findByArtistId", ids(trackRepository.findByArtistId(artist.getId())), pub, priv),
                () -> assertListing("findByAlbumId", ids(trackRepository.findByAlbumId(album.getId())), pub, priv),
                () -> assertListing("findSimilarTracks",
                        ids(trackRepository.findSimilarTracks(reference.getId(), 50)), pub, priv),
                () -> assertListing("findPlayableTracksWithFilters",
                        ids(trackRepository.findPlayableTracksWithFilters(
                                STYLE, null, null, null, null, null, null, null, null, null, null,
                                null, null, null, null, 50, 0, null, null)), pub, priv),
                () -> assertEquals(baselineTotal,
                        trackRepository.countPlayableTracksWithFilters(
                                STYLE, null, null, null, null, null, null, null, null, null, null,
                                null, null, null, null),
                        "countPlayableTracksWithFilters counts the private track"),
                () -> assertListing("findClassifyQueueTrackIds",
                        trackRepository.findClassifyQueueTrackIds(UUID.randomUUID(), 50), pub, priv),
                () -> assertListing("findRecentVerifiedTracks",
                        ids(trackRepository.findRecentVerifiedTracks(50)), pub, priv),
                () -> assertListing("findCuratedTracks", ids(trackRepository.findCuratedTracks(50)), pub, priv),
                () -> assertListing("findFallbackTracks", ids(trackRepository.findFallbackTracks(50)), pub, priv),
                () -> assertEquals(2L, styleCount(),
                        "findStyleCounts counts the private track"),
                () -> assertThat(trackRepository.findSubStylesForStyle(STYLE))
                        .as("findSubStylesForStyle lists a sub-style of the private track")
                        .contains(PUBLIC_SUB_STYLE)
                        .doesNotContain(PRIVATE_SUB_STYLE),
                () -> assertListing("findByStyleWithConfidence",
                        ids(trackRepository.findByStyleWithConfidence(STYLE, 0.5f, 50)), pub, priv),
                () -> assertListing("findByStylesWithConfidence",
                        ids(trackRepository.findByStylesWithConfidence(List.of(STYLE), 0.5f, 50)), pub, priv),
                () -> assertListing("findInstrumentalTracks",
                        ids(trackRepository.findInstrumentalTracks(0.5f, 50)), pub, priv),
                () -> assertListing("findSlowTracks", ids(trackRepository.findSlowTracks(200, 0.5f, 50)), pub, priv),
                () -> assertListing("findFastTracks", ids(trackRepository.findFastTracks(50, 0.5f, 50)), pub, priv),
                () -> assertListing("findBeginnerFriendlyByStyle",
                        ids(trackRepository.findBeginnerFriendlyByStyle(STYLE, 50)), pub, priv),
                () -> assertListing("findAllOrderByCreatedAt",
                        ids(trackRepository.findAllOrderByCreatedAt(50, 0)), pub, priv),
                () -> assertEquals(2L, trackRepository.countTracks(),
                        "countTracks counts the private track"),
                () -> assertEquals(2L, trackRepository.countTracksWithAnalysis(),
                        "countTracksWithAnalysis counts the private track"));
    }

    private long styleCount() {
        return trackRepository.findStyleCounts().stream()
                .filter(row -> STYLE.equals(row[0]))
                .mapToLong(row -> (Long) row[1])
                .findFirst()
                .orElse(0L);
    }

    @Test
    void everyPublicMethodIsClassified() {
        Set<String> unclassified = new TreeSet<>();
        for (Method method : TrackJooqRepository.class.getDeclaredMethods()) {
            if (!Modifier.isPublic(method.getModifiers()) || method.isSynthetic()) {
                continue;
            }
            String name = method.getName();
            if (!FILTERED.contains(name) && !UNFILTERED.contains(name)) {
                unclassified.add(name);
            }
        }

        assertThat(unclassified)
                .as("TrackJooqRepository public methods in neither FILTERED nor UNFILTERED")
                .isEmpty();
    }
}
