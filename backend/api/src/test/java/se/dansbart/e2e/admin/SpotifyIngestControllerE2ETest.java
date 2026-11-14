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
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import se.dansbart.domain.spotify.SpotifyHttpClient;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyAlbumRef;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyArtistRef;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyImportAlbum;
import se.dansbart.domain.spotify.SpotifyHttpClient.SpotifyImportTrack;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;
import se.dansbart.worker.TaskDispatcher;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static se.dansbart.jooq.Tables.ALBUMS;
import static se.dansbart.jooq.Tables.ARTISTS;
import static se.dansbart.jooq.Tables.PLAYBACK_LINKS;
import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.TRACK_ALBUMS;
import static se.dansbart.jooq.Tables.TRACK_ARTISTS;

/**
 * Importing from Spotify is done by the API: it creates the tracks itself and only
 * the analysis goes to a worker.
 */
class SpotifyIngestControllerE2ETest extends AbstractE2ETest {

    private static final String TRACK_ID = "59jXBBQsRmzsUTHK1S9y53";
    private static final String SECOND_TRACK_ID = "0VjIjW4GlUZAMYd2vXMi3b";
    private static final String ALBUM_ID = "albumaaaaaaaaaaaaaaaa1";

    private static final SpotifyArtistRef BAND = new SpotifyArtistRef("artistaaaaaaaaaaaaaaa1", "Spælimenninir");
    private static final SpotifyArtistRef GUEST = new SpotifyArtistRef("artistaaaaaaaaaaaaaaa2", "Gästspelman");
    private static final SpotifyAlbumRef ALBUM = new SpotifyAlbumRef(
        ALBUM_ID, "Spælimenninir i Nordlandet", "https://i.scdn.co/image/cover", "1995", List.of(BAND));

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

    private static SpotifyImportTrack track(String id, String name, String isrc, SpotifyArtistRef... artists) {
        return new SpotifyImportTrack(id, name, 200_000, isrc, List.of(artists), ALBUM);
    }

    private Map<?, ?> postAsAdmin(String path, Map<String, Object> body, int expectedStatus) throws Exception {
        MvcResult result = mockMvc.perform(post(path)
                .with(jwt.adminToken(admin.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(body)))
            .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(expectedStatus);
        return fromJson(result.getResponse().getContentAsString(StandardCharsets.UTF_8), Map.class);
    }

    private UUID trackIdBySpotifyLink(String spotifyId) {
        return dsl.select(PLAYBACK_LINKS.TRACK_ID).from(PLAYBACK_LINKS)
            .where(PLAYBACK_LINKS.PLATFORM.eq("spotify").and(PLAYBACK_LINKS.DEEP_LINK.eq(spotifyId)))
            .fetchOne(PLAYBACK_LINKS.TRACK_ID);
    }

    @Test
    @DisplayName("a single track is created with its artists and album, listed at once and sent to analysis")
    void importsTrack() throws Exception {
        when(spotifyHttpClient.getTrackForImport(TRACK_ID))
            .thenReturn(track(TRACK_ID, "Hamborg Sekstur", "FOA000000001", BAND, GUEST));

        Map<?, ?> body = postAsAdmin("/api/spotify/ingest/track", Map.of("spotifyTrackId", TRACK_ID), 200);
        assertThat(body.get("created")).isEqualTo(1);
        assertThat(body.get("existing")).isEqualTo(0);

        UUID trackId = trackIdBySpotifyLink(TRACK_ID);
        Record track = dsl.selectFrom(TRACKS).where(TRACKS.ID.eq(trackId)).fetchOne();
        assertThat(track.get(TRACKS.TITLE)).isEqualTo("Hamborg Sekstur");
        assertThat(track.get(TRACKS.ISRC)).isEqualTo("FOA000000001");
        assertThat(track.get(TRACKS.PROCESSING_STATUS)).isEqualTo("PENDING");
        assertThat(track.get(TRACKS.UPLOADER_ID)).isEqualTo(admin.getId());

        assertThat(dsl.select(ARTISTS.NAME, TRACK_ARTISTS.ROLE).from(TRACK_ARTISTS)
            .join(ARTISTS).on(ARTISTS.ID.eq(TRACK_ARTISTS.ARTIST_ID))
            .where(TRACK_ARTISTS.TRACK_ID.eq(trackId))
            .fetchMap(ARTISTS.NAME, TRACK_ARTISTS.ROLE))
            .containsEntry("Spælimenninir", "primary")
            .containsEntry("Gästspelman", "featured");
        assertThat(dsl.select(ARTISTS.SPOTIFY_ID).from(ARTISTS).where(ARTISTS.NAME.eq("Spælimenninir"))
            .fetchOne(ARTISTS.SPOTIFY_ID)).isEqualTo(BAND.id());

        Record album = dsl.select(ALBUMS.TITLE, ALBUMS.COVER_IMAGE_URL).from(TRACK_ALBUMS)
            .join(ALBUMS).on(ALBUMS.ID.eq(TRACK_ALBUMS.ALBUM_ID))
            .where(TRACK_ALBUMS.TRACK_ID.eq(trackId)).fetchOne();
        assertThat(album.get(ALBUMS.TITLE)).isEqualTo("Spælimenninir i Nordlandet");
        assertThat(album.get(ALBUMS.COVER_IMAGE_URL)).isEqualTo("https://i.scdn.co/image/cover");

        verify(taskDispatcher).dispatchAudioAnalysis(trackId);

        mockMvc.perform(get("/api/admin/tracks").with(jwt.adminToken(admin.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[0].title").value("Hamborg Sekstur"));

        // Importing it again changes nothing and starts no new analysis.
        Map<?, ?> again = postAsAdmin("/api/spotify/ingest/track", Map.of("spotifyTrackId", TRACK_ID), 200);
        assertThat(again.get("created")).isEqualTo(0);
        assertThat(again.get("existing")).isEqualTo(1);
        assertThat(dsl.fetchCount(PLAYBACK_LINKS, PLAYBACK_LINKS.DEEP_LINK.eq(TRACK_ID))).isEqualTo(1);
        verify(taskDispatcher, times(1)).dispatchAudioAnalysis(trackId);
    }

    @Test
    @DisplayName("an album import creates the new tracks and links the ones the library already has")
    void importsAlbum() throws Exception {
        Track known = testData.track().withTitle("Known").build();
        dsl.insertInto(PLAYBACK_LINKS)
            .set(PLAYBACK_LINKS.ID, UUID.randomUUID())
            .set(PLAYBACK_LINKS.TRACK_ID, known.getId())
            .set(PLAYBACK_LINKS.PLATFORM, "spotify")
            .set(PLAYBACK_LINKS.DEEP_LINK, TRACK_ID)
            .set(PLAYBACK_LINKS.IS_WORKING, true)
            .execute();
        when(spotifyHttpClient.getAlbumForImport(ALBUM_ID)).thenReturn(new SpotifyImportAlbum(ALBUM, List.of(
            track(TRACK_ID, "Hamborg Sekstur", null, BAND),
            track(SECOND_TRACK_ID, "Vals från Tórshavn", null, BAND))));

        Map<?, ?> body = postAsAdmin("/api/spotify/ingest/album", Map.of("spotifyAlbumId", ALBUM_ID), 200);
        assertThat(body.get("created")).isEqualTo(1);
        assertThat(body.get("existing")).isEqualTo(1);

        UUID albumId = dsl.select(ALBUMS.ID).from(ALBUMS).where(ALBUMS.SPOTIFY_ID.eq(ALBUM_ID)).fetchOne(ALBUMS.ID);
        assertThat(dsl.fetchCount(TRACK_ALBUMS, TRACK_ALBUMS.ALBUM_ID.eq(albumId))).isEqualTo(2);
        assertThat(trackIdBySpotifyLink(TRACK_ID)).isEqualTo(known.getId());
        verify(taskDispatcher).dispatchAudioAnalysis(trackIdBySpotifyLink(SECOND_TRACK_ID));
        verify(taskDispatcher, times(0)).dispatchAudioAnalysis(known.getId());
    }

    @Test
    @DisplayName("a track the library has under its ISRC gets the Spotify link instead of a duplicate")
    void matchesByIsrc() throws Exception {
        Track known = testData.track().withTitle("Known").build();
        dsl.update(TRACKS).set(TRACKS.ISRC, "FOA000000001").where(TRACKS.ID.eq(known.getId())).execute();
        when(spotifyHttpClient.getTrackForImport(TRACK_ID))
            .thenReturn(track(TRACK_ID, "Hamborg Sekstur", "FOA000000001", BAND));

        Map<?, ?> body = postAsAdmin("/api/spotify/ingest/track", Map.of("spotifyTrackId", TRACK_ID), 200);
        assertThat(body.get("existing")).isEqualTo(1);
        assertThat(trackIdBySpotifyLink(TRACK_ID)).isEqualTo(known.getId());
    }

    @Test
    @DisplayName("playlists and artists are imported through the admin ingest endpoint")
    void importsPlaylistAndArtist() throws Exception {
        when(spotifyHttpClient.getPlaylistTracksForImport("playlistaaaaaaaaaaaaa1"))
            .thenReturn(List.of(track(TRACK_ID, "Hamborg Sekstur", null, BAND)));
        Map<?, ?> playlist = postAsAdmin("/api/admin/ingest",
            Map.of("resourceId", "playlistaaaaaaaaaaaaa1", "resourceType", "PLAYLIST"), 200);
        assertThat(playlist.get("created")).isEqualTo(1);

        when(spotifyHttpClient.getArtistAlbums(BAND.id())).thenReturn(List.of(
            new SpotifyHttpClient.SpotifyAlbum(ALBUM_ID, ALBUM.name(), 2),
            new SpotifyHttpClient.SpotifyAlbum("albumaaaaaaaaaaaaaaaa2", "Broken", 3)));
        when(spotifyHttpClient.getAlbumForImport(ALBUM_ID)).thenReturn(new SpotifyImportAlbum(ALBUM, List.of(
            track(TRACK_ID, "Hamborg Sekstur", null, BAND),
            track(SECOND_TRACK_ID, "Vals från Tórshavn", null, BAND))));
        when(spotifyHttpClient.getAlbumForImport("albumaaaaaaaaaaaaaaaa2"))
            .thenThrow(new HttpClientErrorException(HttpStatus.TOO_MANY_REQUESTS));

        Map<?, ?> artist = postAsAdmin("/api/admin/ingest", Map.of("resourceId", BAND.id(), "resourceType", "ARTIST"), 200);
        assertThat(artist.get("created")).isEqualTo(1);
        assertThat(artist.get("existing")).isEqualTo(1);
        assertThat(artist.get("failedAlbums")).isEqualTo(1);
    }

    @Test
    @DisplayName("a missing resource or an unreachable Spotify is reported to the admin")
    void reportsSpotifyFailures() throws Exception {
        when(spotifyHttpClient.getTrackForImport(TRACK_ID))
            .thenThrow(new HttpClientErrorException(HttpStatus.NOT_FOUND));
        Map<?, ?> missing = postAsAdmin("/api/spotify/ingest/track", Map.of("spotifyTrackId", TRACK_ID), 404);
        assertThat(missing.get("message")).isEqualTo("Låten finns inte på Spotify.");

        when(spotifyHttpClient.getAlbumForImport(ALBUM_ID))
            .thenThrow(new SpotifyHttpClient.SpotifyUnavailableException("no token", null));
        Map<?, ?> down = postAsAdmin("/api/spotify/ingest/album", Map.of("spotifyAlbumId", ALBUM_ID), 422);
        assertThat(down.get("message")).isEqualTo("Det gick inte att nå Spotify. Försök igen om en stund.");
    }

    @Test
    @DisplayName("only admins may import")
    void regularUserIsForbidden() throws Exception {
        mockMvc.perform(post("/api/spotify/ingest/track")
                .with(jwt.userToken(UUID.randomUUID()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("spotifyTrackId", TRACK_ID))))
            .andExpect(status().isForbidden());
    }
}
