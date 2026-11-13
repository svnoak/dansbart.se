package se.dansbart.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * A guest code lets anyone add to a playlist or a dance list, and do nothing else to it.
 */
class GuestCodeE2ETest extends AbstractE2ETest {

    private static final UUID OWNER_ID = UUID.fromString("30000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_USER_ID = UUID.fromString("30000000-0000-0000-0000-000000000002");
    private static final UUID DANCE_ID = UUID.fromString("30000000-0000-0000-0000-000000000003");

    private User owner;
    private User otherUser;
    private Playlist playlist;
    private Track track;

    @BeforeEach
    void setUp() {
        owner = testData.user().withId(OWNER_ID).withUsername("guest_code_owner").withDisplayName("Anna").build();
        otherUser = testData.user().withId(OTHER_USER_ID).withUsername("guest_code_other").build();
        Artist artist = testData.artist().withName("Test Artist").verified().build();
        track = testData.track().withTitle("Hambo från Svärdsjö").withArtist(artist).build();
        playlist = testData.playlist().withName("Dansafton").withOwner(owner).build();
        testData.dance().withId(DANCE_ID).withName("Bakmes").withSlug("bakmes").build();
    }

    private String createPlaylistCode() throws Exception {
        String body = mockMvc.perform(post("/api/playlists/" + playlist.getId() + "/guest-code")
                .with(jwt.userToken(owner.getId())))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return new ObjectMapper().readTree(body).get("code").asText();
    }

    private String createDanceList() throws Exception {
        String body = mockMvc.perform(post("/api/dance-lists")
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Kvällens danser"))))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return new ObjectMapper().readTree(body).get("id").asText();
    }

    private String createDanceListCode(String danceListId) throws Exception {
        String body = mockMvc.perform(post("/api/dance-lists/" + danceListId + "/guest-code")
                .with(jwt.userToken(owner.getId())))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return new ObjectMapper().readTree(body).get("code").asText();
    }

    @Test
    @DisplayName("the owner creates a six character code and sees it on the playlist")
    void ownerCreatesCode() throws Exception {
        String code = createPlaylistCode();
        assertThat(code).matches("[A-HJ-NP-Z2-9]{6}");

        mockMvc.perform(get("/api/playlists/" + playlist.getId()).with(jwt.userToken(owner.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.guestCode").value(code));
    }

    @Test
    @DisplayName("someone who cannot manage the playlist cannot create or remove its code")
    void otherUserCannotManageCode() throws Exception {
        mockMvc.perform(post("/api/playlists/" + playlist.getId() + "/guest-code")
                .with(jwt.userToken(otherUser.getId())))
            .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/playlists/" + playlist.getId() + "/guest-code")
                .with(jwt.userToken(otherUser.getId())))
            .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/playlists/" + playlist.getId() + "/guest-code"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a guest without an account sees the playlist and adds a track to it")
    void guestAddsTrack() throws Exception {
        String code = createPlaylistCode();

        mockMvc.perform(get("/api/public/guest-codes/" + code))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.type").value("playlist"))
            .andExpect(jsonPath("$.name").value("Dansafton"))
            .andExpect(jsonPath("$.ownerName").value("Anna"))
            .andExpect(jsonPath("$.tracks", hasSize(0)));

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/tracks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", track.getId().toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tracks", hasSize(1)))
            .andExpect(jsonPath("$.tracks[0].title").value("Hambo från Svärdsjö"));

        mockMvc.perform(get("/api/playlists/" + playlist.getId()).with(jwt.userToken(owner.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tracks", hasSize(1)))
            .andExpect(jsonPath("$.tracks[0].addedByGuest").value(true));
    }

    @Test
    @DisplayName("the code is read without regard to case, spaces and dashes")
    void codeIsNormalized() throws Exception {
        String code = createPlaylistCode();
        String typed = code.substring(0, 3).toLowerCase() + "-" + code.substring(3).toLowerCase();

        mockMvc.perform(get("/api/public/guest-codes/" + typed))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Dansafton"));
    }

    @Test
    @DisplayName("a track that is already in the playlist gives 409")
    void duplicateTrackConflicts() throws Exception {
        String code = createPlaylistCode();
        testData.addTrackToPlaylist(playlist, track, 0);

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/tracks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", track.getId().toString()))))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("the code gives no right to remove a track or to read the playlist the normal way")
    void codeGivesNoOtherAccess() throws Exception {
        createPlaylistCode();
        testData.addTrackToPlaylist(playlist, track, 0);

        mockMvc.perform(delete("/api/playlists/" + playlist.getId() + "/tracks/" + track.getId()))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/playlists/" + playlist.getId()))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("a removed code and a replaced code stop working")
    void removedAndReplacedCodesStopWorking() throws Exception {
        String first = createPlaylistCode();
        String second = createPlaylistCode();
        assertThat(second).isNotEqualTo(first);

        mockMvc.perform(get("/api/public/guest-codes/" + first)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/guest-codes/" + second)).andExpect(status().isOk());

        mockMvc.perform(delete("/api/playlists/" + playlist.getId() + "/guest-code")
                .with(jwt.userToken(owner.getId())))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/public/guest-codes/" + second)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/public/guest-codes/" + second + "/tracks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", track.getId().toString()))))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/playlists/" + playlist.getId()).with(jwt.userToken(owner.getId())))
            .andExpect(jsonPath("$.guestCode").doesNotExist());
    }

    @Test
    @DisplayName("an unknown code gives 404")
    void unknownCodeIsNotFound() throws Exception {
        mockMvc.perform(get("/api/public/guest-codes/ZZZZZZ")).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/public/guest-codes/abc")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("a guest adds a dance from the site and a dance by name to a dance list")
    void guestAddsDances() throws Exception {
        String danceListId = createDanceList();
        String code = createDanceListCode(danceListId);

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/dances")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.type").value("dance_list"))
            .andExpect(jsonPath("$.dances", hasSize(1)))
            .andExpect(jsonPath("$.dances[0].name").value("Bakmes"));

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/dances")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "  Slängpolska från Bingsjö  "))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dances", hasSize(2)))
            .andExpect(jsonPath("$.dances[1].name").value("Slängpolska från Bingsjö"));

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/dances")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
            .andExpect(status().isConflict());

        mockMvc.perform(post("/api/public/guest-codes/" + code + "/dances")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "   "))))
            .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/dance-lists/" + danceListId).with(jwt.userToken(owner.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.guestCode").value(code))
            .andExpect(jsonPath("$.entries", hasSize(2)))
            .andExpect(jsonPath("$.entries[0].addedByGuest").value(true));
    }

    @Test
    @DisplayName("a playlist code does not take a dance, and a dance list code does not take a track")
    void codeOnlyTakesItsOwnKind() throws Exception {
        String playlistCode = createPlaylistCode();
        String danceListCode = createDanceListCode(createDanceList());

        mockMvc.perform(post("/api/public/guest-codes/" + playlistCode + "/dances")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Schottis"))))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/public/guest-codes/" + danceListCode + "/tracks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", track.getId().toString()))))
            .andExpect(status().isBadRequest());
    }
}
