package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import se.dansbart.domain.dance.Dance;
import se.dansbart.domain.dance.DanceJooqRepository;
import se.dansbart.domain.dancelist.DanceList;
import se.dansbart.domain.dancelist.DanceListEntry;
import se.dansbart.domain.dancelist.DanceListEntryJooqRepository;
import se.dansbart.domain.dancelist.DanceListEntryTrack;
import se.dansbart.domain.dancelist.DanceListEntryTrackJooqRepository;
import se.dansbart.domain.dancelist.DanceListJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for jOOQ-based DanceListEntryTrackJooqRepository (type-safe SQL).
 */
class DanceListEntryTrackJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private DanceListJooqRepository danceListJooqRepository;

    @Autowired
    private DanceListEntryJooqRepository danceListEntryJooqRepository;

    @Autowired
    private DanceListEntryTrackJooqRepository danceListEntryTrackJooqRepository;

    @Autowired
    private DanceJooqRepository danceJooqRepository;

    @Autowired
    private TestDataFactory testData;

    private DanceListEntry createDanceListEntry() {
        User owner = testData.user().build();
        flush();
        DanceList list = DanceList.builder()
            .userId(owner.getId())
            .groupId(null)
            .name("Test list")
            .build();
        danceListJooqRepository.insert(list);
        flush();

        String slug = "test-dance-" + UUID.randomUUID();
        danceJooqRepository.upsertDances(List.of(Dance.builder().name("Test Dance").slug(slug).build()));
        flush();
        UUID danceId = danceJooqRepository.findBySlug(slug).orElseThrow().getId();

        DanceListEntry entry = DanceListEntry.builder()
            .danceListId(list.getId())
            .danceId(danceId)
            .freeTextName(null)
            .playMode("in_order")
            .position(1)
            .build();
        danceListEntryJooqRepository.insert(entry);
        flush();
        return entry;
    }

    @Nested
    @DisplayName("insert")
    class Insert {

        @Test
        @DisplayName("inserts links with position, voter_id and vote_cast")
        void insertsLinksWithAllFields() {
            DanceListEntry entry = createDanceListEntry();
            Track track = testData.track().build();
            UUID voterId = UUID.randomUUID();
            flush();

            DanceListEntryTrack link = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track.getId())
                .position(1)
                .voterId(voterId)
                .voteCast(true)
                .build();
            danceListEntryTrackJooqRepository.insert(link);
            flush();

            assertThat(link.getId()).isNotNull();
        }
    }

    @Nested
    @DisplayName("findByEntryIdOrderByPosition")
    class FindByEntryIdOrderByPosition {

        @Test
        @DisplayName("returns links in position order")
        void returnsLinksInPositionOrder() {
            DanceListEntry entry = createDanceListEntry();
            Track track1 = testData.track().build();
            Track track2 = testData.track().build();
            UUID voterId = UUID.randomUUID();
            flush();

            DanceListEntryTrack link1 = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track1.getId())
                .position(2)
                .voterId(voterId)
                .voteCast(false)
                .build();
            DanceListEntryTrack link2 = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track2.getId())
                .position(1)
                .voterId(voterId)
                .voteCast(true)
                .build();
            danceListEntryTrackJooqRepository.insert(link1);
            danceListEntryTrackJooqRepository.insert(link2);
            flush();

            List<DanceListEntryTrack> found = danceListEntryTrackJooqRepository.findByEntryIdOrderByPosition(entry.getId());

            assertThat(found).hasSize(2);
            assertThat(found.get(0).getPosition()).isEqualTo(1);
            assertThat(found.get(1).getPosition()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("UNIQUE constraint on entry_id and track_id")
    class UniqueConstraint {

        @Test
        @DisplayName("rejects same track twice in one entry")
        void rejectsSameTrackTwice() {
            DanceListEntry entry = createDanceListEntry();
            Track track = testData.track().build();
            UUID voterId = UUID.randomUUID();
            flush();

            DanceListEntryTrack link1 = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track.getId())
                .position(1)
                .voterId(voterId)
                .voteCast(true)
                .build();
            danceListEntryTrackJooqRepository.insert(link1);
            flush();

            DanceListEntryTrack link2 = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track.getId())
                .position(2)
                .voterId(voterId)
                .voteCast(false)
                .build();

            assertThatThrownBy(() -> {
                danceListEntryTrackJooqRepository.insert(link2);
                flush();
            }).isNotNull();
        }
    }

    @Nested
    @DisplayName("vote_cast")
    class VoteCast {

        @Test
        @DisplayName("vote_cast round-trips")
        void voteCastRoundTrips() {
            DanceListEntry entry = createDanceListEntry();
            Track track = testData.track().build();
            UUID voterId = UUID.randomUUID();
            flush();

            DanceListEntryTrack linkTrue = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track.getId())
                .position(1)
                .voterId(voterId)
                .voteCast(true)
                .build();
            danceListEntryTrackJooqRepository.insert(linkTrue);
            flush();

            var found = danceListEntryTrackJooqRepository.findById(linkTrue.getId());
            assertThat(found).isPresent();
            assertThat(found.get().getVoteCast()).isTrue();

            Track track2 = testData.track().build();
            flush();

            DanceListEntryTrack linkFalse = DanceListEntryTrack.builder()
                .entryId(entry.getId())
                .trackId(track2.getId())
                .position(2)
                .voterId(voterId)
                .voteCast(false)
                .build();
            danceListEntryTrackJooqRepository.insert(linkFalse);
            flush();

            var foundFalse = danceListEntryTrackJooqRepository.findById(linkFalse.getId());
            assertThat(foundFalse).isPresent();
            assertThat(foundFalse.get().getVoteCast()).isFalse();
        }
    }
}
