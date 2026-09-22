package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.fixture.TestDataFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for jOOQ-based PlaylistJooqRepository (type-safe SQL).
 */
class PlaylistJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private PlaylistJooqRepository playlistJooqRepository;

    @Autowired
    private GroupJooqRepository groupJooqRepository;

    @Autowired
    private TestDataFactory testData;

    @Test
    @DisplayName("findByGroupIdWithTrackCount returns playlists owned by group")
    void findByGroupIdWithTrackCount_returnsPlaylistsOwnedByGroup() {
        Group group = Group.builder().name("Test Group").build();
        groupJooqRepository.insert(group);

        Playlist playlist = Playlist.builder()
            .groupId(group.getId())
            .userId(null)
            .name("Gruppens lista")
            .build();
        playlistJooqRepository.insert(playlist);

        var found = playlistJooqRepository.findByGroupIdWithTrackCount(group.getId(), true);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).playlist().getId()).isEqualTo(playlist.getId());
        assertThat(found.get(0).playlist().getName()).isEqualTo("Gruppens lista");
        assertThat(found.get(0).playlist().getGroupId()).isEqualTo(group.getId());

        var foundById = playlistJooqRepository.findById(playlist.getId());
        assertThat(foundById).isPresent();
        assertThat(foundById.get().getGroupId()).isEqualTo(group.getId());
        assertThat(foundById.get().getUserId()).isNull();
    }

    @Test
    @DisplayName("findEditableByUserId returns own edit collaborations and managed group playlists")
    void findEditableByUserId_returnsOwnEditCollaborationsAndManagedGroupPlaylists() {
        User user = testData.user().withUsername("user1").build();
        User otherUser = testData.user().withUsername("other").build();
        Group group = testData.group().withName("Test Group").build();
        Group groupNoManagePermission = testData.group().withName("No Manage Group").build();

        // Included: Own playlist
        Playlist ownPlaylist = testData.playlist().withName("Own Playlist").withOwner(user).build();

        // Included: Edit collaboration
        Playlist editCollab = testData.playlist().withName("Edit Collaboration").withOwner(otherUser).build();
        testData.addCollaborator(editCollab, user, "edit");

        // Excluded: View collaboration
        Playlist viewCollab = testData.playlist().withName("View Collaboration").withOwner(otherUser).build();
        testData.addCollaborator(viewCollab, user, "view");

        // Excluded: Pending edit collaboration
        Playlist pendingEditCollab = testData.playlist().withName("Pending Edit").withOwner(otherUser).build();
        testData.addPendingCollaborator(pendingEditCollab, user, "edit");

        // Included: Group playlist with manage permission
        Playlist groupPlaylist = testData.playlist().withName("Group Playlist").withGroup(group).build();
        testData.addGroupMember(group, user, false, false, true, false, false);

        // Excluded: Group playlist without manage permission
        Playlist groupNoManage = testData.playlist().withName("Group No Manage").withGroup(groupNoManagePermission).build();
        testData.addGroupMember(groupNoManagePermission, user, false, false, false, false, false);

        // Excluded: Pending group membership
        Group groupPending = testData.group().withName("Pending Group").build();
        Playlist groupPlaylistPending = testData.playlist().withName("Group Pending").withGroup(groupPending).build();
        testData.addPendingGroupMember(groupPending, user);

        var found = playlistJooqRepository.findEditableByUserId(user.getId());

        assertThat(found)
            .hasSize(3)
            .extracting(PlaylistJooqRepository.EditablePlaylistRecord::id)
            .containsExactlyInAnyOrder(
                ownPlaylist.getId(),
                editCollab.getId(),
                groupPlaylist.getId()
            );
    }
}
