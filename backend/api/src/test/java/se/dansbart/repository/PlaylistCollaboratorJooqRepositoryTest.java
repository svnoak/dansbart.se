package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.user.PlaylistCollaborator;
import se.dansbart.domain.user.PlaylistCollaboratorJooqRepository;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Tests for jOOQ-based PlaylistCollaboratorJooqRepository (type-safe SQL).
 */
class PlaylistCollaboratorJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private PlaylistCollaboratorJooqRepository playlistCollaboratorJooqRepository;

    @Autowired
    private GroupJooqRepository groupJooqRepository;

    @Autowired
    private TestDataFactory testData;

    @Test
    @DisplayName("save and findById round-trip a collaborator that has a group and no user")
    void saveAndFindById_withGroupAndNoUser_roundTrips() {
        User owner = testData.user().withUsername("owner1").build();
        Playlist playlist = testData.playlist().withName("Test Playlist").withOwner(owner).build();
        Group group = Group.builder().name("Test Group").build();
        groupJooqRepository.insert(group);

        PlaylistCollaborator collab = PlaylistCollaborator.builder()
            .playlistId(playlist.getId())
            .groupId(group.getId())
            .permission("edit")
            .status("pending")
            .invitedBy(owner.getId())
            .build();

        playlistCollaboratorJooqRepository.save(collab);
        flush();

        var found = playlistCollaboratorJooqRepository.findById(collab.getId());
        assertThat(found).isPresent();
        assertThat(found.get().getGroupId()).isEqualTo(group.getId());
        assertThat(found.get().getUserId()).isNull();
    }

    @Test
    @DisplayName("the database rejects a collaborator row with both a user and a group")
    void save_withBothUserAndGroup_isRejectedByTheDatabase() {
        User owner = testData.user().withUsername("owner2").build();
        User invitee = testData.user().withUsername("invitee2").build();
        Playlist playlist = testData.playlist().withName("Test Playlist").withOwner(owner).build();
        Group group = Group.builder().name("Test Group").build();
        groupJooqRepository.insert(group);

        PlaylistCollaborator collab = PlaylistCollaborator.builder()
            .playlistId(playlist.getId())
            .userId(invitee.getId())
            .groupId(group.getId())
            .permission("edit")
            .status("pending")
            .invitedBy(owner.getId())
            .build();

        assertThatThrownBy(() -> {
            playlistCollaboratorJooqRepository.save(collab);
            flush();
        }).isNotNull();
    }

    @Test
    @DisplayName("the database rejects a collaborator row with neither a user nor a group")
    void save_withNeitherUserNorGroup_isRejectedByTheDatabase() {
        User owner = testData.user().withUsername("owner3").build();
        Playlist playlist = testData.playlist().withName("Test Playlist").withOwner(owner).build();

        PlaylistCollaborator collab = PlaylistCollaborator.builder()
            .playlistId(playlist.getId())
            .permission("edit")
            .status("pending")
            .invitedBy(owner.getId())
            .build();

        assertThatThrownBy(() -> {
            playlistCollaboratorJooqRepository.save(collab);
            flush();
        }).isNotNull();
    }
}
