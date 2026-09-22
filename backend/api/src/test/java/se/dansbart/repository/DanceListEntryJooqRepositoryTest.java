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
import se.dansbart.domain.dancelist.DanceListJooqRepository;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for jOOQ-based DanceListEntryJooqRepository (type-safe SQL).
 */
class DanceListEntryJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private DanceListJooqRepository danceListJooqRepository;

    @Autowired
    private DanceListEntryJooqRepository danceListEntryJooqRepository;

    @Autowired
    private DanceJooqRepository danceJooqRepository;

    @Autowired
    private TestDataFactory testData;

    private DanceList createDanceList() {
        User owner = testData.user().build();
        flush();
        DanceList list = DanceList.builder()
            .userId(owner.getId())
            .groupId(null)
            .name("Test list")
            .build();
        danceListJooqRepository.insert(list);
        flush();
        return list;
    }

    private UUID createDance() {
        String slug = "test-dance-" + UUID.randomUUID();
        danceJooqRepository.upsertDances(List.of(Dance.builder().name("Test Dance").slug(slug).build()));
        flush();
        return danceJooqRepository.findBySlug(slug).orElseThrow().getId();
    }

    @Nested
    @DisplayName("insert")
    class Insert {

        @Test
        @DisplayName("inserts entry with an existing dance")
        void insertsEntryWithExistingDance() {
            DanceList list = createDanceList();
            UUID danceId = createDance();

            DanceListEntry entry = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId)
                .freeTextName(null)
                .playMode("in_order")
                .position(1)
                .build();
            danceListEntryJooqRepository.insert(entry);
            flush();

            assertThat(entry.getId()).isNotNull();
        }

        @Test
        @DisplayName("inserts entry with free text name")
        void insertsEntryWithFreeTextName() {
            DanceList list = createDanceList();

            DanceListEntry entry = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(null)
                .freeTextName("Min egen dans")
                .playMode("in_order")
                .position(1)
                .build();
            danceListEntryJooqRepository.insert(entry);
            flush();

            assertThat(entry.getId()).isNotNull();
        }
    }

    @Nested
    @DisplayName("findByDanceListIdOrderByPosition")
    class FindByDanceListIdOrderByPosition {

        @Test
        @DisplayName("returns entries in position order")
        void returnsEntriesInPositionOrder() {
            DanceList list = createDanceList();
            UUID danceId1 = createDance();
            UUID danceId2 = createDance();

            DanceListEntry entry1 = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId1)
                .freeTextName(null)
                .playMode("in_order")
                .position(2)
                .build();
            DanceListEntry entry2 = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId2)
                .freeTextName(null)
                .playMode("in_order")
                .position(1)
                .build();
            danceListEntryJooqRepository.insert(entry1);
            danceListEntryJooqRepository.insert(entry2);
            flush();

            List<DanceListEntry> found = danceListEntryJooqRepository.findByDanceListIdOrderByPosition(list.getId());

            assertThat(found).hasSize(2);
            assertThat(found.get(0).getPosition()).isEqualTo(1);
            assertThat(found.get(1).getPosition()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("playMode")
    class PlayMode {

        @Test
        @DisplayName("play_mode round-trips and defaults to in_order")
        void playModeRoundTripsAndDefaults() {
            DanceList list = createDanceList();
            UUID danceId = createDance();

            DanceListEntry entryWithDefault = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId)
                .freeTextName(null)
                .playMode(null)
                .position(1)
                .build();
            danceListEntryJooqRepository.insert(entryWithDefault);
            flush();

            var found = danceListEntryJooqRepository.findById(entryWithDefault.getId());
            assertThat(found).isPresent();
            assertThat(found.get().getPlayMode()).isEqualTo("in_order");

            DanceListEntry entryWithRandom = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(createDance())
                .freeTextName(null)
                .playMode("random")
                .position(2)
                .build();
            danceListEntryJooqRepository.insert(entryWithRandom);
            flush();

            var foundRandom = danceListEntryJooqRepository.findById(entryWithRandom.getId());
            assertThat(foundRandom).isPresent();
            assertThat(foundRandom.get().getPlayMode()).isEqualTo("random");
        }
    }

    @Nested
    @DisplayName("UNIQUE constraint on dance_list_id and dance_id")
    class UniqueConstraint {

        @Test
        @DisplayName("rejects same dance twice in one list")
        void rejectsSameDanceTwice() {
            DanceList list = createDanceList();
            UUID danceId = createDance();

            DanceListEntry entry1 = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId)
                .freeTextName(null)
                .playMode("in_order")
                .position(1)
                .build();
            danceListEntryJooqRepository.insert(entry1);
            flush();

            DanceListEntry entry2 = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(danceId)
                .freeTextName(null)
                .playMode("in_order")
                .position(2)
                .build();

            assertThatThrownBy(() -> {
                danceListEntryJooqRepository.insert(entry2);
                flush();
            }).isNotNull();
        }
    }

    @Nested
    @DisplayName("CHECK constraint on dance_id and free_text_name")
    class CheckConstraint {

        @Test
        @DisplayName("rejects entry with neither dance_id nor free_text_name")
        void rejectsNoContent() {
            DanceList list = createDanceList();

            DanceListEntry entry = DanceListEntry.builder()
                .danceListId(list.getId())
                .danceId(null)
                .freeTextName(null)
                .playMode("in_order")
                .position(1)
                .build();

            assertThatThrownBy(() -> {
                danceListEntryJooqRepository.insert(entry);
                flush();
            }).isNotNull();
        }
    }
}
