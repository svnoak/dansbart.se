package se.dansbart.e2e;

import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** E2E tests for the public, read-only routes under /api/public for playlists and dance lists. */
class PublicListControllerE2ETest extends AbstractE2ETest {

    private static final UUID OWNER_ID = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
    private static final UUID DANCE_ID = UUID.fromString("00000000-0000-0000-0000-0000000000d1");

    @Autowired
    private DSLContext dsl;

    private User owner;
    private Artist artist;

    @BeforeEach
    void setUp() {
        owner = testData.user().withId(OWNER_ID).withUsername("public_list_owner").build();
        artist = testData.artist().withName("Test Artist").verified().build();
        testData.dance().withId(DANCE_ID).withName("Test Dance").withSlug("test-dance").build();
    }

    @Nested
    @DisplayName("GET /api/public/playlists/{id}")
    class GetPublicPlaylist {

        @Test
        @DisplayName("should return a public playlist to an anonymous request without manager-only fields")
        void publicPlaylist_withoutAuth_shouldReturn200() throws Exception {
            Playlist playlist = testData.playlist().withName("Bygdedans").withOwner(owner)
                .withShareToken("a-share-token").isPublic().build();
            Track track = testData.track().withTitle("Public Track").withArtist(artist).complete().build();
            testData.addTrackToPlaylist(playlist, track, 0);

            mockMvc.perform(get("/api/public/playlists/{id}", playlist.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(playlist.getId().toString()))
                .andExpect(jsonPath("$.name").value("Bygdedans"))
                .andExpect(jsonPath("$.trackCount").value(1))
                .andExpect(jsonPath("$.tracks", hasSize(1)))
                .andExpect(jsonPath("$.tracks[0].track.title").value("Public Track"))
                .andExpect(jsonPath("$.shareToken").doesNotExist())
                .andExpect(jsonPath("$.guestCode").doesNotExist())
                .andExpect(jsonPath("$.collaborators").doesNotExist())
                .andExpect(jsonPath("$.viewerCanManage").doesNotExist());
        }

        @Test
        @DisplayName("should return 404 for a private playlist, even to its owner")
        void privatePlaylist_shouldReturn404() throws Exception {
            Playlist playlist = testData.playlist().withName("Privat").withOwner(owner).build();

            mockMvc.perform(get("/api/public/playlists/{id}", playlist.getId()))
                .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/public/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should return 404 for an unknown playlist")
        void unknownPlaylist_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/public/playlists/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should not play a private library track of a public playlist")
        void publicPlaylist_privateTrack_isNotPlayable() throws Exception {
            Playlist playlist = testData.playlist().withName("Blandat").withOwner(owner).isPublic().build();
            Track track = testData.track().withTitle("Own Library Track").withArtist(artist).complete().build();
            testData.addTrackToPlaylist(playlist, track, 0);
            dsl.execute("update tracks set is_private = true where id = ?", track.getId());

            mockMvc.perform(get("/api/public/playlists/{id}", playlist.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tracks[0].track.playable").value(false));
        }
    }

    @Nested
    @DisplayName("GET /api/public/dance-lists/{id}")
    class GetPublicDanceList {

        @Test
        @DisplayName("should return a public dance list to an anonymous request without manager-only fields")
        void publicDanceList_withoutAuth_shouldReturn200() throws Exception {
            String danceListId = createDanceList("Kursdansen", true);
            String entryId = addEntryWithDance(danceListId);
            Track track = testData.track().withTitle("Public Track").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track);

            mockMvc.perform(get("/api/public/dance-lists/{id}", danceListId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(danceListId))
                .andExpect(jsonPath("$.name").value("Kursdansen"))
                .andExpect(jsonPath("$.entries", hasSize(1)))
                .andExpect(jsonPath("$.entries[0].danceName").value("Test Dance"))
                .andExpect(jsonPath("$.entries[0].tracks", hasSize(1)))
                .andExpect(jsonPath("$.shareToken").doesNotExist())
                .andExpect(jsonPath("$.guestCode").doesNotExist())
                .andExpect(jsonPath("$.collaborators").doesNotExist())
                .andExpect(jsonPath("$.viewerCanManage").doesNotExist());
        }

        @Test
        @DisplayName("should return 404 for a private dance list, even to its owner")
        void privateDanceList_shouldReturn404() throws Exception {
            String danceListId = createDanceList("Privat", false);

            mockMvc.perform(get("/api/public/dance-lists/{id}", danceListId))
                .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/public/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should return 404 for an unknown dance list")
        void unknownDanceList_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/public/dance-lists/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("should leave out a private library track of a public dance list")
        void publicDanceList_privateTrack_isLeftOut() throws Exception {
            String danceListId = createDanceList("Blandat", true);
            String entryId = addEntryWithDance(danceListId);
            Track openTrack = testData.track().withTitle("Open Track").withArtist(artist).complete().build();
            Track privateTrack = testData.track().withTitle("Own Library Track").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, openTrack);
            addTrackToEntry(danceListId, entryId, privateTrack);
            dsl.execute("update tracks set is_private = true where id = ?", privateTrack.getId());

            mockMvc.perform(get("/api/public/dance-lists/{id}", danceListId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries[0].tracks", hasSize(1)))
                .andExpect(jsonPath("$.entries[0].tracks[0].track.title").value("Open Track"));
        }
    }

    private String createDanceList(String name, boolean isPublic) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists")
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", name, "isPublic", isPublic))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return fromJson(response, Map.class).get("id").toString();
    }

    private String addEntryWithDance(String danceListId) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return fromJson(response, Map.class).get("id").toString();
    }

    private void addTrackToEntry(String danceListId, String entryId, Track track) throws Exception {
        mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", track.getId().toString()))))
            .andExpect(status().isCreated());
    }
}
