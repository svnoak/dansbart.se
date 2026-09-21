package se.dansbart.repository;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.playlist.PlaylistJooqRepository;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupJooqRepository;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Tests for jOOQ-based PlaylistJooqRepository (type-safe SQL).
 */
class PlaylistJooqRepositoryTest extends AbstractRepositoryTest {

    @Autowired
    private PlaylistJooqRepository playlistJooqRepository;

    @Autowired
    private GroupJooqRepository groupJooqRepository;

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
}
