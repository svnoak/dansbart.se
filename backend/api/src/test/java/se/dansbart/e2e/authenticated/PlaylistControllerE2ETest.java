package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
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
        @DisplayName("should return 404 when non-owner tries to update")
        void updatePlaylist_byNonOwner_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Hacked Name"))))
                .andExpect(status().isNotFound());
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
        @DisplayName("should return 404 when non-owner tries to generate token")
        void generateShareToken_byNonOwner_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Owner's Playlist").withOwner(owner).build();

            mockMvc.perform(post("/api/playlists/{id}/share-token", playlist.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }
    }
}
