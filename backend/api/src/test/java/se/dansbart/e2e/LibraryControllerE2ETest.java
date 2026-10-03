package se.dansbart.e2e;

import com.fasterxml.jackson.databind.JsonNode;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * E2E tests for the library routes: import, list and delete of a person's own track sources.
 */
class LibraryControllerE2ETest extends AbstractE2ETest {

    private static final String HASH_A = "a".repeat(64);
    private static final String HASH_B = "b".repeat(64);
    private static final Pattern HEX_64 = Pattern.compile("[0-9a-f]{64}");
    private static final String ISRC = "SEABC2600001";

    @Autowired
    private DSLContext dsl;

    private User first;
    private User second;
    private RequestPostProcessor firstSignedIn;
    private RequestPostProcessor secondSignedIn;
    private Artist artist;

    @BeforeEach
    void setUp() {
        first = testData.user().withId(UUID.randomUUID()).withUsername("first").build();
        second = testData.user().withId(UUID.randomUUID()).withUsername("second").build();
        firstSignedIn = jwt.userToken(first.getId());
        secondSignedIn = jwt.userToken(second.getId());
        artist = testData.artist().withName("Library Artist").verified().build();
    }

    private String body(String hash, String provider, String fileId, String title, Integer durationMs, String isrc) {
        return "{\"contentHash\":\"" + hash + "\",\"provider\":\"" + provider + "\",\"providerFileId\":"
            + (fileId == null ? "null" : "\"" + fileId + "\"") + ",\"title\":\"" + title
            + "\",\"artist\":\"Tag Artist\",\"album\":\"Tag Album\",\"durationMs\":" + durationMs
            + ",\"isrc\":" + (isrc == null ? "null" : "\"" + isrc + "\"") + "}";
    }

    private String body(String hash, String provider, String fileId, String title, Integer durationMs, String artist, String album) {
        return "{\"contentHash\":\"" + hash + "\",\"provider\":\"" + provider + "\",\"providerFileId\":"
            + (fileId == null ? "null" : "\"" + fileId + "\"") + ",\"title\":\"" + title
            + "\",\"artist\":" + (artist == null ? "null" : "\"" + artist + "\"")
            + ",\"album\":" + (album == null ? "null" : "\"" + album + "\"")
            + ",\"durationMs\":" + durationMs + "}";
    }

    private JsonNode importTrack(RequestPostProcessor user, String hash, String title, Integer durationMs, String isrc)
            throws Exception {
        String json = mockMvc.perform(post("/api/library/tracks").with(user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(hash, "LOCAL", null, title, durationMs, isrc)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    private JsonNode importTrack(RequestPostProcessor user, String hash, String provider, String fileId, String title, Integer durationMs)
            throws Exception {
        return importTrack(user, hash, provider, fileId, title, durationMs, null);
    }

    private JsonNode importTrack(RequestPostProcessor user, String hash, String provider, String fileId, String title, Integer durationMs, String isrc)
            throws Exception {
        String json = mockMvc.perform(post("/api/library/tracks").with(user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(hash, provider, fileId, title, durationMs, isrc)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    private JsonNode importTrack(RequestPostProcessor user, String hash, String provider, String fileId, String title, Integer durationMs, String artist, String album)
            throws Exception {
        String json = mockMvc.perform(post("/api/library/tracks").with(user)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(hash, provider, fileId, title, durationMs, artist, album)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    private Track catalogTrack(String title, String isrc, int durationMs) {
        Track track = testData.track().withTitle(title).withArtist(artist).withDanceStyle("Polska").complete().build();
        dsl.execute("update tracks set isrc = ?, duration_ms = ? where id = ?", isrc, durationMs, track.getId());
        return track;
    }

    private <T> T scalar(Class<T> type, String sql, Object... args) {
        return dsl.fetchOne(sql, args).get(0, type);
    }

    private boolean isPrivate(String trackId) {
        return scalar(Boolean.class, "select is_private from tracks where id = ?::uuid", trackId);
    }

    @Test
    @DisplayName("every library route answers an anonymous request with 401")
    void anonymousGets401OnEveryLibraryRoute() throws Exception {
        mockMvc.perform(post("/api/library/tracks").contentType(MediaType.APPLICATION_JSON)
                .content(body(HASH_A, "LOCAL", null, "Polska", 1000, null)))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/library/tracks")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/library/sources/{id}", UUID.randomUUID())).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/library/my-tracks")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/library/tracks/{id}", UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("an invalid hash or provider gets 400")
    void invalidHashOrProviderGets400() throws Exception {
        for (String badHash : new String[] {"abc", "A".repeat(64), "g".repeat(64)}) {
            mockMvc.perform(post("/api/library/tracks").with(firstSignedIn)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body(badHash, "LOCAL", null, "Polska", 1000, null)))
                .andExpect(status().isBadRequest());
        }
        mockMvc.perform(post("/api/library/tracks").with(firstSignedIn)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(HASH_A, "DROPBOX", null, "Polska", 1000, null)))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the first import creates a private track and a source")
    void firstImportCreatesPrivateTrackAndSource() throws Exception {
        JsonNode result = importTrack(firstSignedIn, HASH_A, "My Polska", 180000, null);

        assertFalse(result.get("linkedToCatalog").asBoolean());
        String trackId = result.get("trackId").asText();
        assertTrue(isPrivate(trackId));
        assertEquals(HASH_A, scalar(String.class, "select content_hash from tracks where id = ?::uuid", trackId));
        assertEquals(180000, scalar(Integer.class, "select duration_ms from tracks where id = ?::uuid", trackId));
        assertEquals(1, scalar(Integer.class, "select count(*) from user_track_sources where id = ?::uuid and user_id = ?",
            result.get("sourceId").asText(), first.getId()));
    }

    @Test
    @DisplayName("a second person with the same hash links to the same track and sees their own title")
    void secondPersonWithSameHashLinksToSameTrack() throws Exception {
        JsonNode one = importTrack(firstSignedIn, HASH_A, "First Title", 180000, null);
        JsonNode two = importTrack(secondSignedIn, HASH_A, "Second Title", 180000, null);

        assertEquals(one.get("trackId").asText(), two.get("trackId").asText());
        assertNotEquals(one.get("sourceId").asText(), two.get("sourceId").asText());
        assertEquals("First Title", listOf(firstSignedIn).get(0).get("title").asText());
        assertEquals("Second Title", listOf(secondSignedIn).get(0).get("title").asText());
    }

    @Test
    @DisplayName("a repeated identical import by the same person returns the same source")
    void repeatedImportBySamePersonIsIdempotent() throws Exception {
        JsonNode one = importTrack(firstSignedIn, HASH_A, "My Polska", 180000, null);
        JsonNode two = importTrack(firstSignedIn, HASH_A, "My Polska", 180000, null);

        assertEquals(one.get("sourceId").asText(), two.get("sourceId").asText());
        assertEquals(1, listOf(firstSignedIn).size());
    }

    @Test
    @DisplayName("a matching ISRC links to the catalog track and sets its hash")
    void matchingIsrcLinksToCatalogTrackAndSetsItsHash() throws Exception {
        Track catalog = catalogTrack("Catalog Polska", ISRC, 180000);

        JsonNode result = importTrack(firstSignedIn, HASH_A, "My Polska", 182500, ISRC);

        assertTrue(result.get("linkedToCatalog").asBoolean());
        assertEquals(catalog.getId().toString(), result.get("trackId").asText());
        assertFalse(isPrivate(catalog.getId().toString()));
        assertEquals(HASH_A, scalar(String.class, "select content_hash from tracks where id = ?", catalog.getId()));
    }

    @Test
    @DisplayName("an ISRC with a duration mismatch creates a private track")
    void isrcWithDurationMismatchCreatesPrivateTrack() throws Exception {
        Track catalog = catalogTrack("Catalog Polska", ISRC, 180000);

        JsonNode result = importTrack(firstSignedIn, HASH_A, "My Polska", 183001, ISRC);

        assertFalse(result.get("linkedToCatalog").asBoolean());
        assertNotEquals(catalog.getId().toString(), result.get("trackId").asText());
        assertTrue(isPrivate(result.get("trackId").asText()));
        assertEquals(null, scalar(String.class, "select content_hash from tracks where id = ?", catalog.getId()));
    }

    @Test
    @DisplayName("an ISRC on two catalog tracks creates a private track")
    void isrcOnTwoCatalogTracksCreatesPrivateTrack() throws Exception {
        catalogTrack("Catalog Polska One", ISRC, 180000);
        catalogTrack("Catalog Polska Two", ISRC, 180000);

        JsonNode result = importTrack(firstSignedIn, HASH_A, "My Polska", 180000, ISRC);

        assertFalse(result.get("linkedToCatalog").asBoolean());
        assertTrue(isPrivate(result.get("trackId").asText()));
    }

    @Test
    @DisplayName("a known hash wins over a matching ISRC")
    void knownHashWinsOverIsrc() throws Exception {
        catalogTrack("Catalog Polska", ISRC, 180000);
        Track existing = testData.track().withTitle("Existing Private").withArtist(artist).build();
        dsl.execute("update tracks set is_private = true, content_hash = ?, duration_ms = 180000 where id = ?",
            HASH_A, existing.getId());

        JsonNode result = importTrack(firstSignedIn, HASH_A, "My Polska", 180000, ISRC);

        assertEquals(existing.getId().toString(), result.get("trackId").asText());
        assertFalse(result.get("linkedToCatalog").asBoolean());
    }

    @Test
    @DisplayName("the list returns own sources newest first and no hash")
    void listReturnsOwnSourcesNewestFirstWithoutHash() throws Exception {
        importTrack(firstSignedIn, HASH_A, "Older", 180000, null);
        importTrack(firstSignedIn, HASH_B, "Newer", 170000, null);
        importTrack(secondSignedIn, "c".repeat(64), "Someone Else", 160000, null);

        String json = mockMvc.perform(get("/api/library/tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode list = objectMapper.readTree(json);

        assertEquals(2, list.size());
        assertEquals("Newer", list.get(0).get("title").asText());
        assertEquals("Older", list.get(1).get("title").asText());
        assertEquals("Tag Artist", list.get(0).get("artist").asText());
        assertEquals("LOCAL", list.get(0).get("provider").asText());
        assertTrue(list.get(0).has("sourceId") && list.get(0).has("trackId") && list.get(0).has("addedAt"));
        assertFalse(HEX_64.matcher(json).find(), "the list holds a content hash");
    }

    @Test
    @DisplayName("a person deletes their own source and gets 404 for another person's source")
    void deleteRemovesOwnSourceAndRejectsAnotherPersonsSource() throws Exception {
        JsonNode own = importTrack(firstSignedIn, HASH_A, "Mine", 180000, null);
        JsonNode other = importTrack(secondSignedIn, HASH_B, "Theirs", 170000, null);

        mockMvc.perform(delete("/api/library/sources/{id}", other.get("sourceId").asText()).with(firstSignedIn))
            .andExpect(status().isNotFound());
        assertEquals(1, scalar(Integer.class, "select count(*) from user_track_sources where id = ?::uuid",
            other.get("sourceId").asText()));

        mockMvc.perform(delete("/api/library/sources/{id}", own.get("sourceId").asText()).with(firstSignedIn))
            .andExpect(status().is2xxSuccessful());
        assertEquals(0, listOf(firstSignedIn).size());
    }

    private String matchBody(String hash) {
        return "{\"contentHash\":\"" + hash + "\"}";
    }

    @Test
    @DisplayName("the hash of the own source matches")
    void matchConfirmsTheHashOfOwnSource() throws Exception {
        JsonNode own = importTrack(firstSignedIn, HASH_A, "Mine", 180000, null);

        String json = mockMvc.perform(post("/api/library/sources/{id}/match", own.get("sourceId").asText())
                .with(firstSignedIn).contentType(MediaType.APPLICATION_JSON).content(matchBody(HASH_A)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertTrue(objectMapper.readTree(json).get("matches").asBoolean());
        assertFalse(HEX_64.matcher(json).find(), "the answer holds a content hash");
    }

    @Test
    @DisplayName("another hash does not match")
    void matchRejectsAnotherHash() throws Exception {
        JsonNode own = importTrack(firstSignedIn, HASH_A, "Mine", 180000, null);

        String json = mockMvc.perform(post("/api/library/sources/{id}/match", own.get("sourceId").asText())
                .with(firstSignedIn).contentType(MediaType.APPLICATION_JSON).content(matchBody(HASH_B)))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();

        assertFalse(objectMapper.readTree(json).get("matches").asBoolean());
    }

    @Test
    @DisplayName("a match request for another person's source gets 404")
    void matchGives404ForAnotherPersonsSource() throws Exception {
        JsonNode other = importTrack(secondSignedIn, HASH_A, "Theirs", 170000, null);

        mockMvc.perform(post("/api/library/sources/{id}/match", other.get("sourceId").asText())
                .with(firstSignedIn).contentType(MediaType.APPLICATION_JSON).content(matchBody(HASH_A)))
            .andExpect(status().isNotFound());
    }

    private JsonNode listOf(RequestPostProcessor user) throws Exception {
        String json = mockMvc.perform(get("/api/library/tracks").with(user))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json);
    }

    @Test
    @DisplayName("same provider and hash is skipped and keeps the tags")
    void sameProviderAndHashIsSkippedAndKeepsTheTags() throws Exception {
        JsonNode first = importTrack(firstSignedIn, HASH_A, "LOCAL", "one.mp3", "First", 180000);
        assertFalse(first.get("skipped").asBoolean());
        String firstTrackId = first.get("trackId").asText();
        String firstSourceId = first.get("sourceId").asText();

        JsonNode second = importTrack(firstSignedIn, HASH_A, "LOCAL", "two.mp3", "Second", 180000);
        assertTrue(second.get("skipped").asBoolean());
        assertEquals(firstSourceId, second.get("sourceId").asText());
        assertEquals(firstTrackId, second.get("trackId").asText());

        JsonNode list = listOf(firstSignedIn);
        assertEquals(1, list.size());
        assertEquals("First", list.get(0).get("title").asText());
    }

    @Test
    @DisplayName("exact repeat import is skipped")
    void exactRepeatImportIsSkipped() throws Exception {
        JsonNode first = importTrack(firstSignedIn, HASH_A, "LOCAL", "one.mp3", "Title", 180000);
        assertFalse(first.get("skipped").asBoolean());
        String firstTrackId = first.get("trackId").asText();
        String firstSourceId = first.get("sourceId").asText();

        JsonNode second = importTrack(firstSignedIn, HASH_A, "LOCAL", "one.mp3", "Changed", 180000);
        assertTrue(second.get("skipped").asBoolean());
        assertEquals(firstSourceId, second.get("sourceId").asText());
        assertEquals(firstTrackId, second.get("trackId").asText());

        JsonNode list = listOf(firstSignedIn);
        assertEquals(1, list.size());
        assertEquals("Title", list.get(0).get("title").asText());
    }

    @Test
    @DisplayName("same hash from another provider adds a source on the same track")
    void sameHashFromAnotherProviderAddsASourceOnTheSameTrack() throws Exception {
        JsonNode first = importTrack(firstSignedIn, HASH_A, "LOCAL", null, "First", 180000);
        assertFalse(first.get("skipped").asBoolean());
        String trackId = first.get("trackId").asText();

        JsonNode second = importTrack(firstSignedIn, HASH_A, "GDRIVE", "drive-1", "Second", 180000);
        assertFalse(second.get("skipped").asBoolean());
        assertEquals(trackId, second.get("trackId").asText());
        assertNotEquals(first.get("sourceId").asText(), second.get("sourceId").asText());

        JsonNode list = listOf(firstSignedIn);
        assertEquals(2, list.size());
    }

    @Test
    @DisplayName("repeat import after ISRC link is skipped")
    void repeatImportAfterIsrcLinkIsSkipped() throws Exception {
        Track catalog = catalogTrack("Catalog Polska", ISRC, 180000);

        JsonNode first = importTrack(firstSignedIn, HASH_A, "LOCAL", null, "My Polska", 180000, ISRC);
        assertFalse(first.get("skipped").asBoolean());
        assertTrue(first.get("linkedToCatalog").asBoolean());
        assertEquals(catalog.getId().toString(), first.get("trackId").asText());

        JsonNode second = importTrack(firstSignedIn, HASH_A, "LOCAL", null, "My Polska", 180000, null);
        assertTrue(second.get("skipped").asBoolean());
        assertEquals(first.get("trackId").asText(), second.get("trackId").asText());
        assertEquals(first.get("sourceId").asText(), second.get("sourceId").asText());
    }

    @Test
    @DisplayName("GDRIVE import with same file id and new hash is not skipped")
    void driveImportWithSameFileIdAndNewHashIsNotSkipped() throws Exception {
        JsonNode first = importTrack(firstSignedIn, HASH_A, "GDRIVE", "drive-1", "First", 180000);
        assertFalse(first.get("skipped").asBoolean());
        String firstTrackId = first.get("trackId").asText();
        String firstSourceId = first.get("sourceId").asText();

        JsonNode second = importTrack(firstSignedIn, HASH_B, "GDRIVE", "drive-1", "Second", 180000);
        assertFalse(second.get("skipped").asBoolean());
        assertNotEquals(firstSourceId, second.get("sourceId").asText());

        JsonNode list = listOf(firstSignedIn);
        assertEquals(2, list.size());
    }

    @Test
    @DisplayName("my-tracks lists each track once, newest first by latest source")
    void myTracksListsEachTrackOnce() throws Exception {
        importTrack(firstSignedIn, HASH_A, "LOCAL", "a.mp3", "First", 180000);
        importTrack(firstSignedIn, HASH_A, "GDRIVE", "drive-a", "Second", 180000);
        importTrack(firstSignedIn, HASH_B, "LOCAL", null, "Newer", 170000);

        String json = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracks = objectMapper.readTree(json);

        assertEquals(2, myTracks.size());
        JsonNode firstEntry = myTracks.get(0);
        JsonNode secondEntry = myTracks.get(1);

        assertEquals("Newer", firstEntry.get("track").get("title").asText());
        assertTrue(firstEntry.get("track").get("playable").asBoolean());
        assertTrue(secondEntry.get("track").get("playable").asBoolean());

        JsonNode firstPlaybackLinks = firstEntry.get("track").get("playbackLinks");
        JsonNode secondPlaybackLinks = secondEntry.get("track").get("playbackLinks");
        assertEquals(0, firstPlaybackLinks.size());
        assertEquals(0, secondPlaybackLinks.size());

        assertFalse(firstEntry.get("linkedToCatalog").asBoolean());
        assertFalse(secondEntry.get("linkedToCatalog").asBoolean());

        assertEquals(2, secondEntry.get("sources").size());

        String jsonB = mockMvc.perform(get("/api/library/my-tracks").with(secondSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracksB = objectMapper.readTree(jsonB);
        assertEquals(0, myTracksB.size());
    }

    @Test
    @DisplayName("my-tracks shows catalog track linked by ISRC with catalog title and artist")
    void myTracksPlaysCatalogLinkedTrackFromOwnSource() throws Exception {
        Track catalog = catalogTrack("Catalog Polska", ISRC, 180000);

        importTrack(firstSignedIn, HASH_A, "My Polska", 180000, ISRC);

        String json = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracks = objectMapper.readTree(json);

        assertEquals(1, myTracks.size());
        JsonNode entry = myTracks.get(0);

        assertTrue(entry.get("linkedToCatalog").asBoolean());
        assertTrue(entry.get("track").get("playable").asBoolean());

        JsonNode playbackLinks = entry.get("track").get("playbackLinks");
        assertEquals(0, playbackLinks.size());

        assertEquals("Catalog Polska", entry.get("track").get("title").asText());
        assertEquals(artist.getName(), entry.get("track").get("artistName").asText());
    }

    @Test
    @DisplayName("my-tracks uses earliest source tags for private track")
    void myTracksUsesEarliestSourceTagsForPrivateTrack() throws Exception {
        importTrack(firstSignedIn, HASH_A, "LOCAL", null, "Första", 180000, null);
        importTrack(firstSignedIn, HASH_A, "GDRIVE", "drive-file", "Andra", 180000, null);

        String json = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode myTracks = objectMapper.readTree(json);

        assertEquals(1, myTracks.size());
        JsonNode entry = myTracks.get(0);

        assertEquals("Första", entry.get("track").get("title").asText());
        assertEquals("Tag Artist", entry.get("track").get("artistName").asText());
        assertEquals("Tag Album", entry.get("track").get("albumTitle").asText());
    }

    @Test
    @DisplayName("my-tracks keeps title when earliest source has no artist or album")
    void myTracksKeepsTitleWhenEarliestSourceHasNoArtistOrAlbum() throws Exception {
        importTrack(firstSignedIn, HASH_A, "LOCAL", null, "Utan taggar", 180000, null, null);

        String json = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode myTracks = objectMapper.readTree(json);

        assertEquals(1, myTracks.size());
        JsonNode entry = myTracks.get(0);

        assertEquals("Utan taggar", entry.get("track").get("title").asText());
        assertTrue(entry.get("track").get("artistName").isNull());
        assertTrue(entry.get("track").get("albumTitle").isNull());
    }

    @Test
    @DisplayName("delete-track returns 404 when person holds no source")
    void deleteTrackReturns404WhenPersonHoldsNoSource() throws Exception {
        JsonNode hashAByFirst = importTrack(firstSignedIn, HASH_A, "LOCAL", null, "Mine", 180000);
        importTrack(firstSignedIn, HASH_A, "GDRIVE", "drive-file", "Mine", 180000);
        JsonNode hashBBySecond = importTrack(secondSignedIn, HASH_B, "LOCAL", null, "OnlyTheirs", 170000);

        String trackAId = hashAByFirst.get("trackId").asText();

        mockMvc.perform(delete("/api/library/tracks/{trackId}", trackAId).with(secondSignedIn))
            .andExpect(status().isNotFound());

        String json = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracksFirst = objectMapper.readTree(json);
        assertEquals(1, myTracksFirst.size());

        mockMvc.perform(delete("/api/library/tracks/{trackId}", trackAId).with(firstSignedIn))
            .andExpect(status().isNoContent());

        String jsonAfterDelete = mockMvc.perform(get("/api/library/my-tracks").with(firstSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracksAfterDelete = objectMapper.readTree(jsonAfterDelete);
        assertEquals(0, myTracksAfterDelete.size());

        mockMvc.perform(delete("/api/library/tracks/{trackId}", trackAId).with(firstSignedIn))
            .andExpect(status().isNotFound());

        String jsonB = mockMvc.perform(get("/api/library/my-tracks").with(secondSignedIn))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode myTracksB = objectMapper.readTree(jsonB);
        assertEquals(1, myTracksB.size());
    }
}
