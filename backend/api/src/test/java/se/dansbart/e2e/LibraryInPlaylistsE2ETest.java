package se.dansbart.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.dance.Dance;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * E2E tests for library tracks in playlists and on dance pages.
 */
class LibraryInPlaylistsE2ETest extends AbstractE2ETest {

    private static final String SHARE_TOKEN = "library-playlist-share-token";

    @Autowired
    private DSLContext dsl;

    private User adder;
    private User holder;
    private User stranger;
    private Track privateTrack;
    private Track publicTrack;
    private Dance dance;
    private Playlist playlist;

    @BeforeEach
    void setUp() {
        adder = testData.user().withId(UUID.randomUUID()).withUsername("adder").build();
        holder = testData.user().withId(UUID.randomUUID()).withUsername("holder").build();
        stranger = testData.user().withId(UUID.randomUUID()).withUsername("stranger").build();
        Artist artist = testData.artist().withName("Catalog Artist").verified().build();
        privateTrack = testData.track().withTitle("Private Polska").withArtist(artist)
            .withDanceStyle("Polska").complete().build();
        publicTrack = testData.track().withTitle("Public Polska").withArtist(artist)
            .withDanceStyle("Polska").complete().build();
        dsl.execute("update tracks set is_private = true where id = ?", privateTrack.getId());
        dance = testData.dance().withId(UUID.randomUUID()).withName("Library Dance").withSlug("library-dance").build();
        playlist = testData.playlist().withName("Library Playlist").withOwner(adder).isPublic()
            .withShareToken(SHARE_TOKEN).build();
    }

    private void addSource(User user, String title, String artist, String addedAt) {
        dsl.execute("insert into user_track_sources (id, user_id, track_id, provider, title, artist, added_at)"
                + " values (?, ?, ?, 'LOCAL', ?, ?, ?::timestamptz)",
            UUID.randomUUID(), user.getId(), privateTrack.getId(), title, artist, addedAt);
    }

    private void addToPlaylistAs(User user, Track track) throws Exception {
        mockMvc.perform(post("/api/playlists/{id}/tracks", playlist.getId()).with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"trackId\":\"" + track.getId() + "\"}"))
            .andExpect(status().isOk());
    }

    private JsonNode trackInPlaylist(String body, Track track) throws Exception {
        for (JsonNode entry : objectMapper.readTree(body).get("tracks")) {
            if (track.getId().toString().equals(entry.get("track").get("id").asText())) {
                return entry.get("track");
            }
        }
        throw new AssertionError("track is missing from the playlist");
    }

    private JsonNode privateTrackSeenBy(User viewer) throws Exception {
        var request = viewer == null
            ? get("/api/playlists/share/{token}", SHARE_TOKEN)
            : get("/api/playlists/{id}", playlist.getId()).with(jwt.userToken(viewer.getId()));
        String body = mockMvc.perform(request).andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return trackInPlaylist(body, privateTrack);
    }

    @Test
    @DisplayName("adding a track to a playlist records who added it")
    void addingATrackRecordsWhoAddedIt() throws Exception {
        addToPlaylistAs(adder, publicTrack);
        UUID recorded = dsl.fetchOne("select added_by from playlist_tracks where playlist_id = ? and track_id = ?",
            playlist.getId(), publicTrack.getId()).get(0, UUID.class);
        assertEquals(adder.getId(), recorded);
    }

    @Test
    @DisplayName("a public track in a playlist is playable")
    void publicTrackIsPlayable() throws Exception {
        addToPlaylistAs(adder, publicTrack);
        String body = mockMvc.perform(get("/api/playlists/share/{token}", SHARE_TOKEN))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(trackInPlaylist(body, publicTrack).path("playable").asBoolean(false));
    }

    @Test
    @DisplayName("a holder sees the tags of their own source and can play the track")
    void holderSeesOwnTagsAndPlayable() throws Exception {
        addSource(adder, "Adder Title", "Adder Artist", "2026-01-01T00:00:00Z");
        addSource(holder, "Holder Title", "Holder Artist", "2026-02-01T00:00:00Z");
        addToPlaylistAs(adder, privateTrack);

        JsonNode track = privateTrackSeenBy(holder);
        assertEquals("Holder Title", track.get("title").asText());
        assertEquals("Holder Artist", track.get("artistName").asText());
        assertTrue(track.path("playable").asBoolean(false));
    }

    @Test
    @DisplayName("a non-holder sees the tags of the person who added the track and cannot play it")
    void nonHolderSeesTagsOfWhoAddedItAndNotPlayable() throws Exception {
        addSource(holder, "Earliest Title", "Earliest Artist", "2026-01-01T00:00:00Z");
        addSource(adder, "Adder Title", "Adder Artist", "2026-02-01T00:00:00Z");
        addToPlaylistAs(adder, privateTrack);

        JsonNode track = privateTrackSeenBy(stranger);
        assertEquals("Adder Title", track.get("title").asText());
        assertEquals("Adder Artist", track.get("artistName").asText());
        assertTrue(track.has("playable") && !track.get("playable").asBoolean());
    }

    @Test
    @DisplayName("a non-holder sees the earliest source when the person who added the track holds none")
    void nonHolderFallsBackToEarliestSourceWhenAdderHoldsNone() throws Exception {
        User later = testData.user().withId(UUID.randomUUID()).withUsername("later").build();
        addSource(holder, "Earliest Title", "Earliest Artist", "2026-01-01T00:00:00Z");
        addSource(later, "Later Title", "Later Artist", "2026-03-01T00:00:00Z");
        testData.addTrackToPlaylist(playlist, privateTrack, 0);
        dsl.execute("update playlist_tracks set added_by = ? where playlist_id = ? and track_id = ?",
            adder.getId(), playlist.getId(), privateTrack.getId());

        JsonNode track = privateTrackSeenBy(stranger);
        assertEquals("Earliest Title", track.get("title").asText());
        assertEquals("Earliest Artist", track.get("artistName").asText());
    }

    private void confirmOnDance(Track track) {
        dsl.execute("insert into dance_tracks (dance_id, track_id, is_confirmed) values (?, ?, true)",
            dance.getId(), track.getId());
    }

    @Test
    @DisplayName("a dance page lists a confirmed private track only to a holder")
    void dancePageListsPrivateTrackOnlyForHolder() throws Exception {
        addSource(holder, "Holder Title", "Holder Artist", "2026-02-01T00:00:00Z");
        confirmOnDance(publicTrack);
        confirmOnDance(privateTrack);
        String privateId = privateTrack.getId().toString();

        mockMvc.perform(get("/api/dances/{id}/tracks", dance.getId()).with(jwt.userToken(holder.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.id=='" + privateId + "')]").isNotEmpty());
        mockMvc.perform(get("/api/dances/{id}/tracks", dance.getId()).with(jwt.userToken(stranger.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.id=='" + privateId + "')]").isEmpty());
        mockMvc.perform(get("/api/dances/{id}/tracks", dance.getId()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.id=='" + privateId + "')]").isEmpty());
    }

    @Test
    @DisplayName("the track count of a dance counts public tracks only")
    void danceTrackCountStaysPublicOnly() throws Exception {
        addSource(holder, "Holder Title", "Holder Artist", "2026-02-01T00:00:00Z");
        confirmOnDance(publicTrack);
        confirmOnDance(privateTrack);

        mockMvc.perform(get("/api/dances/{id}", dance.getId()).with(jwt.userToken(holder.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.confirmedTrackCount").value(1));
    }
}
