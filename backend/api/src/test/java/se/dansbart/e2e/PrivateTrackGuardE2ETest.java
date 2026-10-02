package se.dansbart.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.dance.Dance;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * E2E tests for the private track guard: a private track opens only for a holder.
 */
class PrivateTrackGuardE2ETest extends AbstractE2ETest {

    private static final Set<String> VISIBLE_TO_NON_HOLDER = Set.of("id", "title", "artistId", "artistName", "playable");
    private static final String SHARE_TOKEN = "private-guard-share-token";

    @Autowired
    private DSLContext dsl;

    private User holder;
    private User stranger;
    private Artist artist;
    private Track privateTrack;
    private Track publicTrack;
    private Dance dance;
    private Playlist playlist;

    @BeforeEach
    void setUp() {
        holder = testData.user().withId(UUID.randomUUID()).withUsername("holder").build();
        stranger = testData.user().withId(UUID.randomUUID()).withUsername("stranger").build();
        artist = testData.artist().withName("Guard Artist").verified().build();
        privateTrack = testData.track().withTitle("Private Polska").withArtist(artist)
            .withDanceStyle("Polska").complete().build();
        publicTrack = testData.track().withTitle("Public Polska").withArtist(artist)
            .withDanceStyle("Polska").complete().build();
        dance = testData.dance().withId(UUID.randomUUID()).withName("Guard Dance").withSlug("guard-dance").build();

        dsl.execute("update tracks set embedding = '[1,0,0]'::vector where id in (?, ?)",
            privateTrack.getId(), publicTrack.getId());
        dsl.execute("update tracks set is_private = true where id = ?", privateTrack.getId());

        playlist = testData.playlist().withName("Guard Playlist").withOwner(stranger).isPublic()
            .withShareToken(SHARE_TOKEN).build();
        testData.addTrackToPlaylist(playlist, publicTrack, 0);
        testData.addTrackToPlaylist(playlist, privateTrack, 1);
    }

    private void makeHolder() {
        dsl.execute("insert into user_track_sources (id, user_id, track_id, provider, title) values (?, ?, ?, 'LOCAL', ?)",
            UUID.randomUUID(), holder.getId(), privateTrack.getId(), "Private Polska");
    }

    private Map<String, Function<UUID, MockHttpServletRequestBuilder>> trackRoutes() throws Exception {
        String json = MediaType.APPLICATION_JSON_VALUE;
        Map<String, Function<UUID, MockHttpServletRequestBuilder>> routes = new LinkedHashMap<>();
        routes.put("GET track", id -> get("/api/tracks/{id}", id));
        routes.put("GET similar", id -> get("/api/tracks/{id}/similar", id));
        routes.put("POST feedback", id -> post("/api/tracks/{id}/feedback", id).contentType(json)
            .content("{\"suggestedStyle\":\"Polska\"}"));
        routes.put("GET secondary-styles", id -> get("/api/tracks/{id}/secondary-styles", id));
        routes.put("POST confirm-secondary", id -> post("/api/tracks/{id}/confirm-secondary", id)
            .contentType(json).content("{\"style\":\"Hambo\"}"));
        routes.put("POST movement", id -> post("/api/tracks/{id}/movement", id).contentType(json)
            .content("{\"danceStyle\":\"Polska\",\"tags\":[\"bouncy\"]}"));
        routes.put("POST flag", id -> post("/api/tracks/{id}/flag", id));
        routes.put("POST structure", id -> post("/api/tracks/{id}/structure", id).contentType(json)
            .content("{\"bars\":[0.0,2.0],\"sections\":[0.0],\"sectionLabels\":[\"A\"],\"authorAlias\":\"x\"}"));
        routes.put("GET structure-versions", id -> get("/api/tracks/{id}/structure-versions", id));
        routes.put("POST links", id -> post("/api/tracks/{id}/links", id).contentType(json)
            .content("{\"platform\":\"youtube\",\"deepLink\":\"https://youtu.be/abc\"}"));
        routes.put("POST dance vote", id -> post("/api/dances/{danceId}/tracks/{id}/vote", dance.getId(), id)
            .contentType(json).header("X-Voter-ID", UUID.randomUUID().toString()).content("{\"vote\":\"up\"}"));
        routes.put("DELETE dance vote", id -> delete("/api/dances/{danceId}/tracks/{id}/vote", dance.getId(), id)
            .header("X-Voter-ID", UUID.randomUUID().toString()));
        routes.put("POST analytics playback", id -> post("/api/analytics/playback/{id}", id).contentType(json)
            .content("{\"platform\":\"spotify\",\"durationSeconds\":30,\"completed\":false,\"sessionId\":\"s1\"}"));
        return routes;
    }

    private Map<String, Function<UUID, MockHttpServletRequestBuilder>> signedInTrackRoutes() {
        Map<String, Function<UUID, MockHttpServletRequestBuilder>> routes = new LinkedHashMap<>();
        routes.put("POST dance link", id -> post("/api/dances/{danceId}/tracks/{id}", dance.getId(), id));
        routes.put("POST favorite", id -> post("/api/favorites/{id}", id));
        return routes;
    }

    private List<Runnable> expectNotFound(Map<String, Function<UUID, MockHttpServletRequestBuilder>> routes,
            RequestPostProcessor viewer, String viewerName) {
        List<Runnable> checks = new ArrayList<>();
        routes.forEach((name, route) -> checks.add(() -> {
            try {
                mockMvc.perform(route.apply(privateTrack.getId()).with(viewer))
                    .andExpect(status().isNotFound());
            } catch (AssertionError | Exception e) {
                throw new AssertionError(viewerName + " " + name + " should return 404: " + e.getMessage(), e);
            }
        }));
        return checks;
    }

    @Test
    @DisplayName("a stranger gets 404 on every route that takes a private track id")
    void strangerGets404OnEveryTrackRoute() throws Exception {
        makeHolder();
        List<Runnable> checks = expectNotFound(trackRoutes(), request -> request, "anonymous");
        RequestPostProcessor signedIn = jwt.userToken(stranger.getId());
        checks.addAll(expectNotFound(trackRoutes(), signedIn, "signed-in non-holder"));
        checks.addAll(expectNotFound(signedInTrackRoutes(), signedIn, "signed-in non-holder"));
        assertAll(checks.stream().map(check -> (org.junit.jupiter.api.function.Executable) check::run));
    }

    @Test
    @DisplayName("a holder reads and votes on a private track")
    void holderCanReadAndVoteOnPrivateTrack() throws Exception {
        makeHolder();
        mockMvc.perform(get("/api/tracks/{id}", privateTrack.getId()).with(jwt.userToken(holder.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(privateTrack.getId().toString()));

        mockMvc.perform(post("/api/dances/{danceId}/tracks/{id}/vote", dance.getId(), privateTrack.getId())
                .with(jwt.userToken(holder.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"vote\":\"up\"}"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("a public track still answers anonymous reads and votes")
    void publicTrackRoutesStayOpen() throws Exception {
        mockMvc.perform(get("/api/tracks/{id}", publicTrack.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(publicTrack.getId().toString()));

        mockMvc.perform(post("/api/dances/{danceId}/tracks/{id}/vote", dance.getId(), publicTrack.getId())
                .header("X-Voter-ID", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"vote\":\"up\"}"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("similar tracks use the list DTO shape and exclude private tracks")
    void similarTracksReturnListDtoAndNoPrivateTrack() throws Exception {
        makeHolder();
        Track other = testData.track().withTitle("Other Polska").withArtist(artist)
            .withDanceStyle("Polska").complete().build();
        dsl.execute("update tracks set embedding = '[1,0,0.1]'::vector where id = ?", other.getId());

        mockMvc.perform(get("/api/tracks/{id}/similar", publicTrack.getId()).param("limit", "5"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].id").value(other.getId().toString()))
            .andExpect(jsonPath("$[0].artistName").value("Guard Artist"))
            .andExpect(jsonPath("$[0].playbackLinks").isArray())
            .andExpect(jsonPath("$[0].embedding").doesNotExist())
            .andExpect(jsonPath("$[*].id", not(hasItem(privateTrack.getId().toString()))));
    }

    @Test
    @DisplayName("a playlist shows a non-holder only the id, title and artist of a private track")
    void playlistShowsOnlyTitleAndArtistOfPrivateTrackToNonHolder() throws Exception {
        makeHolder();
        String byId = mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                .with(jwt.userToken(stranger.getId())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String byToken = mockMvc.perform(get("/api/playlists/share/{token}", SHARE_TOKEN))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        for (String body : List.of(byId, byToken)) {
            JsonNode track = privateTrackIn(body);
            assertEquals("Private Polska", track.get("title").asText());
            assertEquals("Guard Artist", track.get("artistName").asText());
            List<String> leaked = new ArrayList<>();
            track.fields().forEachRemaining(field -> {
                JsonNode value = field.getValue();
                boolean empty = value.isNull() || (value.isContainerNode() && value.isEmpty());
                if (!VISIBLE_TO_NON_HOLDER.contains(field.getKey()) && !empty) {
                    leaked.add(field.getKey());
                }
            });
            assertTrue(leaked.isEmpty(), "non-holder sees fields: " + leaked);
        }
    }

    @Test
    @DisplayName("a playlist shows the full private track to a holder")
    void playlistShowsFullPrivateTrackToHolder() throws Exception {
        makeHolder();
        String body = mockMvc.perform(get("/api/playlists/{id}", playlist.getId())
                .with(jwt.userToken(holder.getId())))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        JsonNode track = privateTrackIn(body);
        assertEquals("Polska", track.get("danceStyle").asText());
        assertEquals(1, track.get("playbackLinks").size());
    }

    private JsonNode privateTrackIn(String playlistJson) throws Exception {
        for (JsonNode entry : objectMapper.readTree(playlistJson).get("tracks")) {
            if (privateTrack.getId().toString().equals(entry.get("track").get("id").asText())) {
                return entry.get("track");
            }
        }
        throw new AssertionError("private track is missing from the playlist");
    }
}
