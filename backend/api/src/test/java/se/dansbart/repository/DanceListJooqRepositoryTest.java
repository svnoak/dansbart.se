package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import se.dansbart.domain.dancelist.DanceList;
import se.dansbart.domain.dancelist.DanceListJooqRepository;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for jOOQ-based DanceListJooqRepository (type-safe SQL).
 */
class DanceListJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private DanceListJooqRepository danceListJooqRepository;

    @Autowired
    private GroupJooqRepository groupJooqRepository;

    @Autowired
    private TestDataFactory testData;

    @Nested
    @DisplayName("insert and findById")
    class InsertAndFindById {

        @Test
        @DisplayName("inserts dance list and finds it by id")
        void insertsAndFindsById() {
            User owner = testData.user().build();
            flush();

            DanceList danceList = DanceList.builder()
                .userId(owner.getId())
                .groupId(null)
                .name("Min danslista")
                .description("Min lista")
                .isPublic(true)
                .build();
            danceListJooqRepository.insert(danceList);
            flush();

            var found = danceListJooqRepository.findById(danceList.getId());

            assertThat(found).isPresent();
            assertThat(found.get().getId()).isEqualTo(danceList.getId());
            assertThat(found.get().getName()).isEqualTo("Min danslista");
            assertThat(found.get().getUserId()).isEqualTo(owner.getId());
            assertThat(found.get().getGroupId()).isNull();
        }
    }

    @Nested
    @DisplayName("findByUserId")
    class FindByUserId {

        @Test
        @DisplayName("returns only that user's dance lists ordered by name")
        void returnsUsersListsOrderedByName() {
            User user1 = testData.user().build();
            User user2 = testData.user().build();
            flush();

            DanceList list1 = DanceList.builder()
                .userId(user1.getId())
                .groupId(null)
                .name("Zulu danser")
                .build();
            DanceList list2 = DanceList.builder()
                .userId(user1.getId())
                .groupId(null)
                .name("Alfa danser")
                .build();
            DanceList list3 = DanceList.builder()
                .userId(user2.getId())
                .groupId(null)
                .name("Beta danser")
                .build();
            danceListJooqRepository.insert(list1);
            danceListJooqRepository.insert(list2);
            danceListJooqRepository.insert(list3);
            flush();

            List<DanceList> found = danceListJooqRepository.findByUserId(user1.getId());

            assertThat(found).hasSize(2);
            assertThat(found.get(0).getName()).isEqualTo("Alfa danser");
            assertThat(found.get(1).getName()).isEqualTo("Zulu danser");
            assertThat(found).allMatch(list -> list.getUserId().equals(user1.getId()));
        }
    }

    @Nested
    @DisplayName("findByGroupId")
    class FindByGroupId {

        @Test
        @DisplayName("returns the group's dance lists")
        void returnsGroupsLists() {
            Group group = Group.builder().name("Test Group").build();
            groupJooqRepository.insert(group);
            flush();

            DanceList groupList = DanceList.builder()
                .userId(null)
                .groupId(group.getId())
                .name("Gruppens danslista")
                .build();
            danceListJooqRepository.insert(groupList);
            flush();

            List<DanceList> found = danceListJooqRepository.findByGroupId(group.getId());

            assertThat(found).hasSize(1);
            assertThat(found.get(0).getId()).isEqualTo(groupList.getId());
            assertThat(found.get(0).getGroupId()).isEqualTo(group.getId());
            assertThat(found.get(0).getUserId()).isNull();
        }
    }

    @Nested
    @DisplayName("owner CHECK constraint")
    class OwnerCheckConstraint {

        @Test
        @DisplayName("rejects dance list with both user_id and group_id set")
        void rejectsBothUserAndGroupOwners() {
            User user = testData.user().build();
            Group group = Group.builder().name("Test Group").build();
            groupJooqRepository.insert(group);
            flush();

            DanceList invalidList = DanceList.builder()
                .userId(user.getId())
                .groupId(group.getId())
                .name("Invalid lista")
                .build();

            assertThatThrownBy(() -> {
                danceListJooqRepository.insert(invalidList);
                flush();
            }).isNotNull();
        }
    }
}
