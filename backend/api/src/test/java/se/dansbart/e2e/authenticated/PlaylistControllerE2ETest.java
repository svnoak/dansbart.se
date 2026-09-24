package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * E2E tests for PlaylistController authenticated endpoints.
 */
class PlaylistControllerE2ETest extends AbstractE2ETest {

    private static final UUID OWNER_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_USER_ID = UUID.fromString("00000000-0000-0000-0000-000000000002");

    private User owner;
    private User otherUser;
    private Artist artist;

    @BeforeEach
    void setUp() {
        owner = testData.user().withId(OWNER_ID).withUsername("playlist_owner").build();
        otherUser = testData.user().withId(OTHER_USER_ID).withUsername("other_user").build();
        artist = testData.artist().withName("Test Artist").verified().build();
    }

    @Nested
    @DisplayName("POST /api/playlists")
    class CreatePlaylist {

        @Test
        @DisplayName("should create playlist for authenticated user")
        void createPlaylist_shouldCreateForAuthUser() throws Exception {
            mockMvc.perform(post("/api/playlists")
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of(
                        "name", "My Playlist",
                        "description", "A test playlist"
                    ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Playlist"))
                .andExpect(jsonPath("$.description").value("A test playlist"))
                .andExpect(jsonPath("$.userId").value(owner.getId().toString()));
        }

        @Test
        @DisplayName("should return 401 without authentication")
        void createPlaylist_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(post("/api/playlists")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "My Playlist"))))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/playlists")
    class GetMyPlaylists {

        @Test
        @DisplayName("should return user's own playlists")
        void getMyPlaylists_shouldReturnOwnPlaylists() throws Exception {
            testData.playlist().withName("Playlist 1").withOwner(owner).build();
            testData.playlist().withName("Playlist 2").withOwner(owner).build();
            testData.playlist().withName("Other User Playlist").withOwner(otherUser).build();

            mockMvc.perform(get("/api/playlists")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("Playlist 1", "Playlist 2")));
        }

        @Test
        @DisplayName("should include group playlists for accepted member")
        void getMyPlaylists_shouldIncludeGroupPlaylistsForAcceptedMember() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, false, false, false);

            mockMvc.perform(get("/api/playlists")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Group Playlist"))
                .andExpect(jsonPath("$[0].ownerGroup.id").value(group.getId().toString()))
                .andExpect(jsonPath("$[0].ownerGroup.name").value("Test Group"));
        }

        @Test
        @DisplayName("should exclude group playlists for non-member")
        void getMyPlaylists_shouldExcludePrivateGroupPlaylistsForNonMember() throws Exception {
            Group group = testData.group().withName("Other Group").build();
            testData.playlist().withName("Group Playlist").withGroup(group).build();

            mockMvc.perform(get("/api/playlists")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("should exclude group playlists for pending member")
        void getMyPlaylists_shouldExcludeGroupPlaylistsForPendingMember() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addPendingGroupMember(group, owner);

            mockMvc.perform(get("/api/playlists")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    @Nested
    @DisplayName("GET /api/playlists/{id}")
    class GetPlaylist {

        @Test
        @DisplayName("should return playlist by ID")
        void getPlaylist_shouldReturnPlaylistById() throws Exception {
            Playlist playlist = testData.playlist().withName("Test Playlist").withOwner(owner).build();

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(playlist.getId().toString()))
                .andExpect(jsonPath("$.name").value("Test Playlist"));
        }

        @Test
        @DisplayName("should return 404 for non-existent playlist")
        void getPlaylist_withInvalidId_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/playlists/{id}", "00000000-0000-0000-0000-000000000000")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("private playlist by non-collaborator should return 404")
        void getPlaylist_privatePlaylist_byNonCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("private playlist by accepted collaborator should return 200")
        void getPlaylist_privatePlaylist_byAcceptedCollaborator_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "view");

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(playlist.getId().toString()));
        }

        @Test
        @DisplayName("private playlist by pending collaborator should return 404")
        void getPlaylist_privatePlaylist_byPendingCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();
            testData.addPendingCollaborator(playlist, otherUser, "view");

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("public playlist by any logged-in user should return 200")
        void getPlaylist_publicPlaylist_byAnyLoggedInUser_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Public Playlist").withOwner(owner).isPublic().build();

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(playlist.getId().toString()));
        }
    }

    @Nested
    @DisplayName("PUT /api/playlists/{id}")
    class UpdatePlaylist {

        @Test
        @DisplayName("should update own playlist")
        void updatePlaylist_shouldUpdateOwnPlaylist() throws Exception {
            Playlist playlist = testData.playlist().withName("Original Name").withOwner(owner).build();

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of(
                        "name", "Updated Name",
                        "description", "Updated description",
                        "isPublic", true
                    ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Name"))
                .andExpect(jsonPath("$.description").value("Updated description"))
                .andExpect(jsonPath("$.isPublic").value(true));
        }

        @Test
        @DisplayName("should return 404 when non-collaborator tries to update")
        void updatePlaylist_byNonCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Hacked Name"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("edit collaborator should be able to update name")
        void updatePlaylist_byEditCollaborator_canUpdateName() throws Exception {
            Playlist playlist = testData.playlist().withName("Original Name").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Collaborator Renamed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Collaborator Renamed"));
        }

        @Test
        @DisplayName("edit collaborator should not be able to change owner-only fields")
        void updatePlaylist_byEditCollaborator_ownerOnlyFieldsIgnored() throws Exception {
            Playlist playlist = testData.playlist().withName("My Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            // isPublic is an owner-only field — edit collaborators can pass it but it must be silently ignored
            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Collaborator Name", "isPublic", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Collaborator Name"))
                .andExpect(jsonPath("$.isPublic").value(false));
        }
    }

    @Nested
    @DisplayName("DELETE /api/playlists/{id}")
    class DeletePlaylist {

        @Test
        @DisplayName("should delete own playlist")
        void deletePlaylist_shouldDeleteOwnPlaylist() throws Exception {
            Playlist playlist = testData.playlist().withName("To Delete").withOwner(owner).build();

            mockMvc.perform(delete("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());

            // Verify deletion
            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should return 404 when non-owner tries to delete")
        void deletePlaylist_byNonOwner_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();

            mockMvc.perform(delete("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/playlists/{id}/tracks")
    class AddTrack {

        @Test
        @DisplayName("should add track to own playlist")
        void addTrack_shouldAddToOwnPlaylist() throws Exception {
            Playlist playlist = testData.playlist().withName("My Playlist").withOwner(owner).build();
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            mockMvc.perform(post("/api/playlists/{id}/tracks", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackId").value(track.getId().toString()))
                .andExpect(jsonPath("$.playlistId").value(playlist.getId().toString()));
        }

        @Test
        @DisplayName("should return 404 when non-owner tries to add track")
        void addTrack_byNonOwner_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            mockMvc.perform(post("/api/playlists/{id}/tracks", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId()))))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/playlists/{id}/tracks/{trackId}")
    class RemoveTrack {

        @Test
        @DisplayName("should remove track from own playlist")
        void removeTrack_shouldRemoveFromOwnPlaylist() throws Exception {
            Playlist playlist = testData.playlist().withName("My Playlist").withOwner(owner).build();
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            testData.addTrackToPlaylist(playlist, track, 0);

            mockMvc.perform(delete("/api/playlists/{playlistId}/tracks/{trackId}",
                        playlist.getId(), track.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());
        }
    }

    @Nested
    @DisplayName("GET /api/playlists/share/{shareToken}")
    class GetByShareToken {

        @Test
        @DisplayName("should return playlist by share token without auth")
        void getByShareToken_shouldReturnPlaylist() throws Exception {
            Playlist playlist = testData.playlist()
                .withName("Shared Playlist")
                .withOwner(owner)
                .withShareToken("test-share-token-123")
                .build();

            mockMvc.perform(get("/api/playlists/share/{shareToken}", "test-share-token-123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Shared Playlist"))
                .andExpect(jsonPath("$.shareToken").value("test-share-token-123"));
        }

        @Test
        @DisplayName("should return 404 for invalid share token")
        void getByShareToken_withInvalidToken_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/playlists/share/{shareToken}", "invalid-token"))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/playlists/{id}/share-token")
    class GenerateShareToken {

        @Test
        @DisplayName("should generate share token for own playlist")
        void generateShareToken_shouldGenerateForOwnPlaylist() throws Exception {
            Playlist playlist = testData.playlist().withName("My Playlist").withOwner(owner).build();

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").isNotEmpty());
        }

        @Test
        @DisplayName("should return 404 when non-collaborator tries to generate token")
        void generateShareToken_byNonCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("edit collaborator should be able to generate share token")
        void generateShareToken_byEditCollaborator_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("Shared Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").isNotEmpty());
        }
    }

    @Nested
    @DisplayName("DELETE /api/playlists/{id}/share-token")
    class InvalidateShareToken {

        @Test
        @DisplayName("owner should be able to invalidate share token")
        void invalidateShareToken_byOwner_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist()
                .withName("My Playlist")
                .withOwner(owner)
                .withShareToken("token-to-invalidate")
                .build();

            mockMvc.perform(delete("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());

            // Verify token no longer works
            mockMvc.perform(get("/api/playlists/share/{shareToken}", "token-to-invalidate"))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("edit collaborator should be able to invalidate share token")
        void invalidateShareToken_byEditCollaborator_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist()
                .withName("Shared Playlist")
                .withOwner(owner)
                .withShareToken("collab-invalidate-token")
                .build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(delete("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("should return 404 when non-collaborator tries to invalidate token")
        void invalidateShareToken_byNonCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist()
                .withName("Owner's Playlist")
                .withOwner(owner)
                .withShareToken("some-token")
                .build();

            mockMvc.perform(delete("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PUT /api/playlists/{id}/transfer-ownership")
    class TransferOwnership {

        @Test
        @DisplayName("owner should be able to transfer ownership to a collaborator")
        void transferOwnership_byOwner_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("My Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(put("/api/playlists/{id}/transfer-ownership", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(otherUser.getId().toString()));
        }

        @Test
        @DisplayName("non-owner should not be able to transfer ownership")
        void transferOwnership_byNonOwner_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(put("/api/playlists/{id}/transfer-ownership", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/playlists/{id}/collaborators")
    class GetCollaborators {

        @Test
        @DisplayName("should return 404 for unknown playlist")
        void getCollaborators_withInvalidId_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/playlists/{id}/collaborators", "00000000-0000-0000-0000-000000000000")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("own private playlist by owner should return 200")
        void getCollaborators_ownPrivatePlaylist_byOwner_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();

            mockMvc.perform(get("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("private playlist by non-collaborator should return 404")
        void getCollaborators_privatePlaylist_byNonCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();

            mockMvc.perform(get("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("private playlist by accepted collaborator should return 200")
        void getCollaborators_privatePlaylist_byAcceptedCollaborator_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "view");

            mockMvc.perform(get("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("private playlist by pending collaborator should return 404")
        void getCollaborators_privatePlaylist_byPendingCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Private Playlist").withOwner(owner).build();
            testData.addPendingCollaborator(playlist, otherUser, "view");

            mockMvc.perform(get("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("public playlist by any logged-in user should return 200")
        void getCollaborators_publicPlaylist_byAnyLoggedInUser_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Public Playlist").withOwner(owner).isPublic().build();

            mockMvc.perform(get("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("Group-owned playlists")
    class GroupOwnedPlaylistAccess {

        private se.dansbart.domain.group.Group group;

        @BeforeEach
        void setUp() {
            group = testData.group().withName("Test Group").build();
        }

        @Test
        @DisplayName("delete playlist by group member with manage permission should return 204")
        void deletePlaylist_byGroupMemberWithManagePermission_shouldReturn204() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(delete("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("add track by edit collaborator on group playlist should succeed")
        void addTrack_byEditCollaboratorOnGroupPlaylist_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addCollaborator(playlist, otherUser, "edit");
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            mockMvc.perform(post("/api/playlists/{id}/tracks", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackId").value(track.getId().toString()))
                .andExpect(jsonPath("$.playlistId").value(playlist.getId().toString()));
        }

        @Test
        @DisplayName("delete playlist by edit collaborator on group playlist should return 404")
        void deletePlaylist_byEditCollaboratorOnGroupPlaylist_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(delete("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("get private group playlist by accepted member should return 200")
        void getPlaylist_privateGroupPlaylist_byAcceptedMember_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(playlist.getId().toString()));
        }

        @Test
        @DisplayName("get private group playlist by non-member should return 404")
        void getPlaylist_privateGroupPlaylist_byNonMember_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("get private group playlist by pending member should return 404")
        void getPlaylist_privateGroupPlaylist_byPendingMember_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addPendingGroupMember(group, otherUser);

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("transfer ownership on group playlist should return 404")
        void transferOwnership_groupPlaylist_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(put("/api/playlists/{id}/transfer-ownership", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("update playlist by group member without manage permission should return 404")
        void updatePlaylist_byGroupMemberWithoutManagePermission_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("add track by pending edit collaborator should return 404")
        void addTrack_byPendingEditCollaborator_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Personal Playlist").withOwner(owner).build();
            testData.addPendingCollaborator(playlist, otherUser, "edit");
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            mockMvc.perform(post("/api/playlists/{id}/tracks", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId()))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("get group playlist should name owner group")
        void getPlaylist_groupPlaylist_shouldNameOwnerGroup() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ownerGroup.id").value(group.getId().toString()))
                .andExpect(jsonPath("$.ownerGroup.name").value(group.getName()))
                .andExpect(jsonPath("$.owner").doesNotExist());
        }

        @Test
        @DisplayName("get group playlist viewer can manage for member with permission")
        void getPlaylist_groupPlaylist_viewerCanManage() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(true));

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(false));
        }

        @Test
        @DisplayName("get personal playlist viewer can manage for owner and collaborator")
        void getPlaylist_personalPlaylist_viewerCanManage() throws Exception {
            Playlist playlist = testData.playlist().withName("Personal Playlist").withOwner(owner).build();
            testData.addCollaborator(playlist, otherUser, "edit");

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(true));

            mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(false));
        }

        @Test
        @DisplayName("get shared playlist viewer can manage is null")
        void getSharedPlaylist_viewerCanManageIsNull() throws Exception {
            Playlist playlist = testData.playlist()
                .withName("Shared Playlist")
                .withOwner(owner)
                .withShareToken("test-share-token-123")
                .build();

            mockMvc.perform(get("/api/playlists/share/{shareToken}", "test-share-token-123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").doesNotExist());
        }

        @Test
        @DisplayName("invite collaborator by group manager should succeed")
        void inviteCollaborator_groupPlaylist_byManager_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "edit"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(otherUser.getId().toString()))
                .andExpect(jsonPath("$.permission").value("edit"));
        }

        @Test
        @DisplayName("invite collaborator by plain member should return 403")
        void inviteCollaborator_groupPlaylist_byPlainMember_shouldReturn403() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", owner.getUsername(), "permission", "edit"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("invite collaborator for missing playlist should return 404")
        void inviteCollaborator_missingPlaylist_shouldReturn404() throws Exception {
            mockMvc.perform(post("/api/playlists/{id}/collaborators", "00000000-0000-0000-0000-000000000000")
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "edit"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("invite collaborator by non-manager should return 403")
        void inviteCollaborator_byNonManager_shouldReturn403() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, false, false, false);
            UUID thirdUserId = UUID.fromString("00000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", thirdUser.getUsername(), "permission", "edit"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("invite collaborator inviting self should return 400")
        void inviteCollaborator_invitingSelf_shouldReturn400() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", owner.getUsername(), "permission", "edit"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("invite collaborator inviting same person twice should return 409")
        void inviteCollaborator_invitingSamePersonTwice_shouldReturn409() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "edit"))))
                .andExpect(status().isOk());

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "view"))))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("invite collaborator for existing collaborator by non-manager should return 403")
        void inviteCollaborator_byNonManagerForExistingCollaborator_shouldReturn403() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            UUID thirdUserId = UUID.fromString("00000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();
            testData.addGroupMember(group, thirdUser, false, false, false, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "edit"))))
                .andExpect(status().isOk());

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(thirdUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", otherUser.getUsername(), "permission", "view"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("invite collaborator for unknown username should return 422")
        void inviteCollaborator_unknownUsername_shouldReturn422() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", "no_such_user", "permission", "edit"))))
                .andExpect(status().isUnprocessableEntity());
        }

        @Test
        @DisplayName("invite collaborator with username in other case should succeed")
        void inviteCollaborator_usernameInOtherCase_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            User invitee = testData.user()
                .withId(UUID.fromString("00000000-0000-0000-0000-000000000004"))
                .withUsername("Erik89")
                .build();

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", "erik89", "permission", "edit"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(invitee.getId().toString()));
        }

        @Test
        @DisplayName("invite collaborator with blank username should return 400")
        void inviteCollaborator_blankUsername_shouldReturn400() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", "   ", "permission", "edit"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("invite collaborator by non-manager with unknown username should return 403")
        void inviteCollaborator_byNonManagerWithUnknownUsername_shouldReturn403() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, false, false, false);

            mockMvc.perform(post("/api/playlists/{id}/collaborators", playlist.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("username", "no_such_user", "permission", "edit"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("generate share token by group manager should succeed")
        void generateShareToken_groupPlaylist_byManager_shouldSucceed() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").isNotEmpty());
        }

        @Test
        @DisplayName("generate share token by plain member should return 404")
        void generateShareToken_groupPlaylist_byPlainMember_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Group Playlist").withGroup(group).build();
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/playlists/editable")
    class GetEditablePlaylists {

        private Group group;
        private Group groupNoManagePermission;

        @BeforeEach
        void setUp() {
            group = testData.group().withName("Test Group").build();
            groupNoManagePermission = testData.group().withName("No Manage Group").build();
        }

        @Test
        @DisplayName("lists own collaboration and group playlists")
        void getEditablePlaylists_listsOwnCollaborationAndGroupPlaylists() throws Exception {
            // Own playlist
            Playlist ownPlaylist = testData.playlist().withName("Alpha Own").withOwner(owner).build();

            // Edit collaboration
            Playlist editCollab = testData.playlist().withName("Beta Collaboration").withOwner(otherUser).build();
            testData.addCollaborator(editCollab, owner, "edit");

            // View collaboration (excluded)
            Playlist viewCollab = testData.playlist().withName("View Only").withOwner(otherUser).build();
            testData.addCollaborator(viewCollab, owner, "view");

            // Group playlist with manage permission
            Playlist groupPlaylist = testData.playlist().withName("Gamma Group").withGroup(group).build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            // Group playlist without manage permission (excluded)
            Playlist groupNoManage = testData.playlist().withName("Delta No Access").withGroup(groupNoManagePermission).build();
            testData.addGroupMember(groupNoManagePermission, owner, false, false, false, false, false);

            mockMvc.perform(get("/api/playlists/editable")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("Alpha Own", "Beta Collaboration", "Gamma Group")))
                .andExpect(jsonPath("$[*].id", containsInAnyOrder(
                    ownPlaylist.getId().toString(),
                    editCollab.getId().toString(),
                    groupPlaylist.getId().toString()
                )))
                .andExpect(jsonPath("$[?(@.name == 'Alpha Own')].ownerGroupName", containsInAnyOrder((Object) null)))
                .andExpect(jsonPath("$[?(@.name == 'Beta Collaboration')].ownerGroupName", containsInAnyOrder((Object) null)))
                .andExpect(jsonPath("$[?(@.name == 'Gamma Group')].ownerGroupName", containsInAnyOrder("Test Group")));
        }

        @Test
        @DisplayName("without auth should return 401")
        void getEditablePlaylists_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(get("/api/playlists/editable"))
                .andExpect(status().isUnauthorized());
        }
    }
}
