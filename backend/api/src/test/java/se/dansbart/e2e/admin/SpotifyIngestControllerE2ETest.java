package se.dansbart.e2e.admin;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import se.dansbart.domain.spotify.SpotifyHttpClient;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;
import se.dansbart.worker.TaskDispatcher;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static se.dansbart.jooq.Tables.PLAYBACK_LINKS;
import static se.dansbart.jooq.Tables.TRACKS;

/**
 * Importing a single Spotify track creates the track in the API, without the feature worker.
 */
class SpotifyIngestControllerE2ETest extends AbstractE2ETest {

    private static final String SPOTIFY_ID = "59jXBBQsRmzsUTHK1S9y53";

    @Autowired
    private DSLContext dsl;

    @MockBean
    private SpotifyHttpClient spotifyHttpClient;

    @MockBean
    private TaskDispatcher taskDispatcher;

    private User admin;

    @BeforeEach
    void setUp() {
        admin = testData.user().withId(UUID.randomUUID()).withUsername("importer").withRole("ADMIN").build();
    }

    private MvcResult importTrack(String token) throws Exception {
        return mockMvc.perform(post("/api/spotify/ingest/track")
                .with(jwt.adminToken(admin.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("spotifyTrackId", token))))
            .andExpect(status().isOk())
            .andReturn();
    }

    @Test
    @DisplayName("creates the track at once, lists it and starts the analysis")
    void createsTrack() throws Exception {
        when(spotifyHttpClient.getTrack(SPOTIFY_ID)).thenReturn(new SpotifyHttpClient.SpotifyTrackDetails(
            SPOTIFY_ID, "Hamborg Sekstur", List.of("Spælimenninir"), 200_000, "FOA000000001"));

        Map<?, ?> body = fromJson(importTrack(SPOTIFY_ID).getResponse().getContentAsString(), Map.class);
        assertThat(body.get("status")).isEqualTo("created");
        UUID trackId = UUID.fromString((String) body.get("trackId"));

        Record track = dsl.selectFrom(TRACKS).where(TRACKS.ID.eq(trackId)).fetchOne();
        assertThat(track.get(TRACKS.TITLE)).isEqualTo("Hamborg Sekstur");
        assertThat(track.get(TRACKS.ISRC)).isEqualTo("FOA000000001");
        assertThat(track.get(TRACKS.UPLOADER_ID)).isEqualTo(admin.getId());
        assertThat(dsl.fetchExists(PLAYBACK_LINKS, PLAYBACK_LINKS.TRACK_ID.eq(trackId)
            .and(PLAYBACK_LINKS.PLATFORM.eq("spotify")).and(PLAYBACK_LINKS.DEEP_LINK.eq(SPOTIFY_ID)))).isTrue();
        // The audio analysis is dispatched after the commit, which a test transaction never reaches.
        verify(taskDispatcher, never()).dispatchSpotifyIngest(anyString(), anyString());

        mockMvc.perform(get("/api/admin/tracks").with(jwt.adminToken(admin.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].title").value("Hamborg Sekstur"));

        // A second import of the same track leaves the library as it is.
        Map<?, ?> again = fromJson(importTrack(SPOTIFY_ID).getResponse().getContentAsString(), Map.class);
        assertThat(again.get("status")).isEqualTo("exists");
        assertThat(dsl.fetchCount(PLAYBACK_LINKS, PLAYBACK_LINKS.DEEP_LINK.eq(SPOTIFY_ID))).isEqualTo(1);
    }

    @Test
    @DisplayName("hands the import to the worker when the API cannot read the track from Spotify")
    void fallsBackToWorker() throws Exception {
        when(spotifyHttpClient.getTrack(SPOTIFY_ID))
            .thenThrow(new SpotifyHttpClient.SpotifyUnavailableException("no token", null));

        Map<?, ?> body = fromJson(importTrack(SPOTIFY_ID).getResponse().getContentAsString(), Map.class);
        assertThat(body.get("status")).isEqualTo("queued");
        verify(taskDispatcher).dispatchSpotifyIngest("track", SPOTIFY_ID);
        assertThat(dsl.fetchCount(PLAYBACK_LINKS, PLAYBACK_LINKS.DEEP_LINK.eq(SPOTIFY_ID))).isZero();
    }

    @Test
    @DisplayName("only admins may import")
    void regularUserIsForbidden() throws Exception {
        mockMvc.perform(post("/api/spotify/ingest/track")
                .with(jwt.userToken(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("spotifyTrackId", SPOTIFY_ID))))
            .andExpect(status().isForbidden());
    }
}
