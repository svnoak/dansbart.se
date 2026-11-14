package se.dansbart.e2e.authenticated;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import se.dansbart.domain.contribution.LinkMetadataService;
import se.dansbart.domain.contribution.TrackLinkParser;
import se.dansbart.domain.contribution.TrackSubmissionResolverJob;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;
import se.dansbart.worker.TaskDispatcher;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static se.dansbart.jooq.Tables.PLAYBACK_LINKS;
import static se.dansbart.jooq.Tables.STYLE_KEYWORDS;
import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.TRACK_DANCE_STYLES;
import static se.dansbart.jooq.Tables.TRACK_STYLE_VOTES;
import static se.dansbart.jooq.Tables.TRACK_SUBMISSIONS;
import static se.dansbart.jooq.Tables.USERS;

class ContributionControllerE2ETest extends AbstractE2ETest {

    private static final String VIDEO_ID = "dQw4w9WgXcQ";
    private static final String YOUTUBE_URL = "https://www.youtube.com/watch?v=" + VIDEO_ID;
    private static final String SPOTIFY_ID = "4uLU6hMCjMI75M1A2tKUQC";
    private static final String SPOTIFY_URL = "https://open.spotify.com/track/" + SPOTIFY_ID;

    @Autowired
    private DSLContext dsl;

    @Autowired
    private TrackSubmissionResolverJob resolverJob;

    @MockBean
    private LinkMetadataService linkMetadataService;

    @MockBean
    private TaskDispatcher taskDispatcher;

    private User contributor;
    private User admin;

    @BeforeEach
    void setUp() {
        contributor = testData.user().withId(UUID.randomUUID()).withUsername("contributor").build();
        admin = testData.user().withId(UUID.randomUUID()).withUsername("theadmin").withRole("ADMIN").build();
        insertStyle("polska", "Polska", null);
        insertStyle("slängpolska", "Polska", "Slängpolska");
        insertStyle("vals", "Vals", null);
        when(linkMetadataService.lookup(any())).thenReturn(
            new LinkMetadataService.LinkMetadata("Polska efter Pelle", "Spelman", 180_000));
    }

    private void insertStyle(String keyword, String main, String sub) {
        dsl.insertInto(STYLE_KEYWORDS)
            .set(STYLE_KEYWORDS.ID, UUID.randomUUID())
            .set(STYLE_KEYWORDS.KEYWORD, keyword)
            .set(STYLE_KEYWORDS.MAIN_STYLE, main)
            .set(STYLE_KEYWORDS.SUB_STYLE, sub)
            .set(STYLE_KEYWORDS.IS_ACTIVE, true)
            .execute();
    }

    private String trackBody(String url, String main, String sub) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("url", url);
        body.put("mainStyle", main);
        body.put("subStyle", sub);
        body.put("tempoCategory", "Lagom");
        return toJson(body);
    }

    private MvcResult submit(User user, String url, String main, String sub) throws Exception {
        return mockMvc.perform(post("/api/contributions/tracks")
                .with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(trackBody(url, main, sub)))
            .andReturn();
    }

    private void ban(User user) {
        dsl.update(USERS).set(USERS.BANNED_AT, OffsetDateTime.now()).where(USERS.ID.eq(user.getId())).execute();
    }

    @Nested
    @DisplayName("Adding a track")
    class AddTrack {

        @Test
        @DisplayName("anonymous visitors cannot add tracks")
        void anonymousIsRejected() throws Exception {
            mockMvc.perform(post("/api/contributions/tracks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(trackBody(YOUTUBE_URL, "Polska", null)))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("a YouTube link creates a public track with the chosen style")
        void youtubeLinkCreatesTrack() throws Exception {
            MvcResult result = submit(contributor, YOUTUBE_URL, "polska", "Slängpolska");
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            Map<?, ?> body = fromJson(result.getResponse().getContentAsString(), Map.class);
            assertThat(body.get("status")).isEqualTo("CREATED");
            UUID trackId = UUID.fromString((String) body.get("trackId"));

            Record track = dsl.selectFrom(TRACKS).where(TRACKS.ID.eq(trackId)).fetchOne();
            assertThat(track.get(TRACKS.TITLE)).isEqualTo("Polska efter Pelle");
            assertThat(track.get(TRACKS.IS_PRIVATE)).isFalse();
            assertThat(track.get(TRACKS.PROCESSING_STATUS)).isEqualTo("PENDING");
            assertThat(track.get(TRACKS.UPLOADER_ID)).isEqualTo(contributor.getId());

            assertThat(dsl.fetchExists(PLAYBACK_LINKS, PLAYBACK_LINKS.TRACK_ID.eq(trackId)
                .and(PLAYBACK_LINKS.PLATFORM.eq("youtube")).and(PLAYBACK_LINKS.DEEP_LINK.eq(VIDEO_ID)))).isTrue();

            Record style = dsl.selectFrom(TRACK_DANCE_STYLES).where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)).fetchOne();
            assertThat(style.get(TRACK_DANCE_STYLES.DANCE_STYLE)).isEqualTo("Polska");
            assertThat(style.get(TRACK_DANCE_STYLES.SUB_STYLE)).isEqualTo("Slängpolska");
            assertThat(style.get(TRACK_DANCE_STYLES.TEMPO_CATEGORY)).isEqualTo("Lagom");
            assertThat(style.get(TRACK_DANCE_STYLES.IS_PRIMARY)).isTrue();
            assertThat(style.get(TRACK_DANCE_STYLES.IS_USER_CONFIRMED)).isTrue();

            Record submission = dsl.selectFrom(TRACK_SUBMISSIONS).where(TRACK_SUBMISSIONS.TRACK_ID.eq(trackId)).fetchOne();
            assertThat(submission.get(TRACK_SUBMISSIONS.STATUS)).isEqualTo("LINKED");
            assertThat(submission.get(TRACK_SUBMISSIONS.REVIEWED_AT)).isNull();
        }

        @Test
        @DisplayName("an added track is listed at once, before its analysis, while ingested pending tracks stay hidden")
        void addedTrackIsListedBeforeAnalysis() throws Exception {
            testData.track().withTitle("Ingested pending").withDanceStyle("Polska").pending().build();
            submit(contributor, YOUTUBE_URL, "Polska", null);

            mockMvc.perform(get("/api/tracks").param("mainStyle", "Polska"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].title").value("Polska efter Pelle"));
        }

        @Test
        @DisplayName("a link the library already has records the style as a vote")
        void existingLinkBecomesVote() throws Exception {
            Track existing = testData.track().withTitle("Known").complete().build();
            dsl.insertInto(PLAYBACK_LINKS)
                .set(PLAYBACK_LINKS.ID, UUID.randomUUID())
                .set(PLAYBACK_LINKS.TRACK_ID, existing.getId())
                .set(PLAYBACK_LINKS.PLATFORM, "youtube")
                .set(PLAYBACK_LINKS.DEEP_LINK, VIDEO_ID)
                .set(PLAYBACK_LINKS.IS_WORKING, true)
                .execute();

            MvcResult result = submit(contributor, "https://youtu.be/" + VIDEO_ID, "Vals", null);
            Map<?, ?> body = fromJson(result.getResponse().getContentAsString(), Map.class);
            assertThat(body.get("status")).isEqualTo("EXISTS");
            assertThat(body.get("trackId")).isEqualTo(existing.getId().toString());
            assertThat(dsl.fetchCount(TRACKS, TRACKS.TITLE.eq("Polska efter Pelle"))).isZero();
            assertThat(dsl.fetchExists(TRACK_STYLE_VOTES, TRACK_STYLE_VOTES.TRACK_ID.eq(existing.getId())
                .and(TRACK_STYLE_VOTES.VOTER_ID.eq(contributor.getId()))
                .and(TRACK_STYLE_VOTES.SUGGESTED_STYLE.eq("Vals")))).isTrue();
        }

        @Test
        @DisplayName("a Spotify link creates the track at once and starts the analysis, without the ingest worker")
        void spotifyLinkCreatesTrack() throws Exception {
            when(linkMetadataService.lookup(any())).thenReturn(
                new LinkMetadataService.LinkMetadata("Hamborg Sekstur", "Spælimenninir", 200_000, "FOA000000001"));

            MvcResult result = submit(contributor, SPOTIFY_URL, "Polska", null);
            Map<?, ?> body = fromJson(result.getResponse().getContentAsString(), Map.class);
            assertThat(body.get("status")).isEqualTo("CREATED");
            UUID trackId = UUID.fromString((String) body.get("trackId"));

            Record track = dsl.selectFrom(TRACKS).where(TRACKS.ID.eq(trackId)).fetchOne();
            assertThat(track.get(TRACKS.TITLE)).isEqualTo("Hamborg Sekstur");
            assertThat(track.get(TRACKS.ISRC)).isEqualTo("FOA000000001");
            assertThat(track.get(TRACKS.PROCESSING_STATUS)).isEqualTo("PENDING");
            assertThat(track.get(TRACKS.UPLOADER_ID)).isEqualTo(contributor.getId());
            assertThat(dsl.fetchExists(PLAYBACK_LINKS, PLAYBACK_LINKS.TRACK_ID.eq(trackId)
                .and(PLAYBACK_LINKS.PLATFORM.eq("spotify")).and(PLAYBACK_LINKS.DEEP_LINK.eq(SPOTIFY_ID)))).isTrue();
            assertThat(dsl.fetchExists(TRACK_DANCE_STYLES, TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)
                .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq("Polska"))
                .and(TRACK_DANCE_STYLES.IS_USER_CONFIRMED.isTrue()))).isTrue();
            assertThat(dsl.select(TRACK_SUBMISSIONS.STATUS).from(TRACK_SUBMISSIONS)
                .where(TRACK_SUBMISSIONS.TRACK_ID.eq(trackId)).fetchOne(TRACK_SUBMISSIONS.STATUS)).isEqualTo("LINKED");


            mockMvc.perform(get("/api/tracks").param("mainStyle", "Polska"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Hamborg Sekstur"));
        }

        @Test
        @DisplayName("a Spotify link is added with the typed title when the Spotify lookup gives nothing")
        void spotifyLinkWithoutLookup() throws Exception {
            when(linkMetadataService.lookup(any())).thenReturn(
                new LinkMetadataService.LinkMetadata(null, null, null));
            Map<String, Object> request = new java.util.HashMap<>();
            request.put("url", SPOTIFY_URL);
            request.put("title", "Typed title");
            request.put("mainStyle", "Polska");
            MvcResult result = mockMvc.perform(post("/api/contributions/tracks")
                    .with(jwt.userToken(contributor.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(request)))
                .andExpect(status().isOk())
                .andReturn();
            UUID trackId = UUID.fromString((String) fromJson(result.getResponse().getContentAsString(), Map.class).get("trackId"));
            assertThat(dsl.select(TRACKS.TITLE).from(TRACKS).where(TRACKS.ID.eq(trackId)).fetchOne(TRACKS.TITLE))
                .isEqualTo("Typed title");
        }

        @Test
        @DisplayName("a queued Spotify submission from before is still linked once the worker has created the track")
        void queuedSpotifySubmissionIsLinked() throws Exception {
            UUID submissionId = UUID.randomUUID();
            dsl.insertInto(TRACK_SUBMISSIONS)
                .set(TRACK_SUBMISSIONS.ID, submissionId)
                .set(TRACK_SUBMISSIONS.USER_ID, contributor.getId())
                .set(TRACK_SUBMISSIONS.SOURCE, "SPOTIFY")
                .set(TRACK_SUBMISSIONS.EXTERNAL_ID, SPOTIFY_ID)
                .set(TRACK_SUBMISSIONS.DANCE_STYLE, "Polska")
                .set(TRACK_SUBMISSIONS.STATUS, "QUEUED")
                .execute();

            // The worker ingests the track and adds its Spotify link.
            Track ingested = testData.track().withTitle("Ingested").pending().build();
            dsl.insertInto(PLAYBACK_LINKS)
                .set(PLAYBACK_LINKS.ID, UUID.randomUUID())
                .set(PLAYBACK_LINKS.TRACK_ID, ingested.getId())
                .set(PLAYBACK_LINKS.PLATFORM, "spotify")
                .set(PLAYBACK_LINKS.DEEP_LINK, SPOTIFY_ID)
                .set(PLAYBACK_LINKS.IS_WORKING, true)
                .execute();
            resolverJob.run();

            Record submission = dsl.selectFrom(TRACK_SUBMISSIONS).where(TRACK_SUBMISSIONS.ID.eq(submissionId)).fetchOne();
            assertThat(submission.get(TRACK_SUBMISSIONS.STATUS)).isEqualTo("LINKED");
            assertThat(submission.get(TRACK_SUBMISSIONS.TRACK_ID)).isEqualTo(ingested.getId());
            assertThat(dsl.fetchExists(TRACK_DANCE_STYLES, TRACK_DANCE_STYLES.TRACK_ID.eq(ingested.getId())
                .and(TRACK_DANCE_STYLES.DANCE_STYLE.eq("Polska"))
                .and(TRACK_DANCE_STYLES.IS_USER_CONFIRMED.isTrue()))).isTrue();
        }

        @Test
        @DisplayName("after analysis the submitter's style is primary again")
        void finalizeRestoresPrimaryStyle() throws Exception {
            MvcResult result = submit(contributor, YOUTUBE_URL, "Polska", null);
            UUID trackId = UUID.fromString((String) fromJson(result.getResponse().getContentAsString(), Map.class).get("trackId"));

            // Analysis adds its own primary prediction and finishes.
            dsl.update(TRACK_DANCE_STYLES).set(TRACK_DANCE_STYLES.IS_PRIMARY, false)
                .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId)).execute();
            dsl.insertInto(TRACK_DANCE_STYLES)
                .set(TRACK_DANCE_STYLES.ID, UUID.randomUUID())
                .set(TRACK_DANCE_STYLES.TRACK_ID, trackId)
                .set(TRACK_DANCE_STYLES.DANCE_STYLE, "Vals")
                .set(TRACK_DANCE_STYLES.IS_PRIMARY, true)
                .set(TRACK_DANCE_STYLES.CONFIDENCE, 0.8)
                .set(TRACK_DANCE_STYLES.BPM_MULTIPLIER, 1.0)
                .set(TRACK_DANCE_STYLES.EFFECTIVE_BPM, 0)
                .set(TRACK_DANCE_STYLES.CONFIRMATION_COUNT, 0)
                .set(TRACK_DANCE_STYLES.IS_USER_CONFIRMED, false)
                .execute();
            dsl.update(TRACKS).set(TRACKS.PROCESSING_STATUS, "DONE").set(TRACKS.TEMPO_BPM, 120.0)
                .where(TRACKS.ID.eq(trackId)).execute();

            resolverJob.run();

            assertThat(dsl.select(TRACK_DANCE_STYLES.DANCE_STYLE).from(TRACK_DANCE_STYLES)
                .where(TRACK_DANCE_STYLES.TRACK_ID.eq(trackId).and(TRACK_DANCE_STYLES.IS_PRIMARY.isTrue()))
                .fetch(TRACK_DANCE_STYLES.DANCE_STYLE)).containsExactly("Polska");
            assertThat(dsl.select(TRACK_SUBMISSIONS.STATUS).from(TRACK_SUBMISSIONS)
                .where(TRACK_SUBMISSIONS.TRACK_ID.eq(trackId)).fetchOne(TRACK_SUBMISSIONS.STATUS)).isEqualTo("DONE");
        }

        @Test
        @DisplayName("an unknown style, a bad link or a banned user is rejected")
        void rejectsInvalidRequests() throws Exception {
            assertThat(submit(contributor, YOUTUBE_URL, "Masurka", null).getResponse().getStatus()).isEqualTo(400);
            assertThat(submit(contributor, YOUTUBE_URL, "Polska", "Hambo").getResponse().getStatus()).isEqualTo(400);
            assertThat(submit(contributor, "https://example.com/song", "Polska", null).getResponse().getStatus()).isEqualTo(400);

            ban(contributor);
            assertThat(submit(contributor, YOUTUBE_URL, "Polska", null).getResponse().getStatus()).isEqualTo(403);
            assertThat(dsl.fetchCount(TRACK_SUBMISSIONS)).isZero();
        }

        @Test
        @DisplayName("an unplayable video is rejected")
        void rejectsUnplayableVideo() throws Exception {
            when(linkMetadataService.lookup(any(TrackLinkParser.ParsedLink.class)))
                .thenThrow(new LinkMetadataService.UnplayableLinkException("YouTube-videon finns inte."));
            mockMvc.perform(post("/api/contributions/tracks")
                    .with(jwt.userToken(contributor.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(trackBody(YOUTUBE_URL, "Polska", null)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value("YouTube-videon finns inte."));
        }
    }

    @Nested
    @DisplayName("Adding a dance style")
    class AddStyle {

        private MvcResult createStyle(User user, String name, String parent) throws Exception {
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("name", name);
            body.put("parentStyle", parent);
            return mockMvc.perform(post("/api/contributions/styles")
                    .with(jwt.userToken(user.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andReturn();
        }

        @Test
        @DisplayName("a new main style shows up in the style tree")
        void addsMainStyle() throws Exception {
            assertThat(createStyle(contributor, "  masurka ", null).getResponse().getStatus()).isEqualTo(200);
            mockMvc.perform(get("/api/styles/tree"))
                .andExpect(jsonPath("$[?(@.name == 'Masurka')]", hasSize(1)));
        }

        @Test
        @DisplayName("a sub-style is added under an existing main style")
        void addsSubStyle() throws Exception {
            MvcResult result = createStyle(contributor, "Bondpolska", "polska");
            assertThat(result.getResponse().getStatus()).isEqualTo(200);
            Map<?, ?> body = fromJson(result.getResponse().getContentAsString(), Map.class);
            assertThat(body.get("mainStyle")).isEqualTo("Polska");
            assertThat(body.get("subStyle")).isEqualTo("Bondpolska");
            mockMvc.perform(get("/api/styles/tree"))
                .andExpect(jsonPath("$[?(@.name == 'Polska')].subStyles[*]", org.hamcrest.Matchers.hasItem("Bondpolska")));
        }

        @Test
        @DisplayName("duplicates, unknown parents and banned users are rejected")
        void rejectsInvalidStyles() throws Exception {
            assertThat(createStyle(contributor, "polska", null).getResponse().getStatus()).isEqualTo(409);
            assertThat(createStyle(contributor, "slängpolska", "Polska").getResponse().getStatus()).isEqualTo(409);
            assertThat(createStyle(contributor, "Ny", "Finns inte").getResponse().getStatus()).isEqualTo(400);
            assertThat(createStyle(contributor, "<script>", null).getResponse().getStatus()).isEqualTo(400);
            ban(contributor);
            assertThat(createStyle(contributor, "Masurka", null).getResponse().getStatus()).isEqualTo(403);
        }
    }

    @Test
    @DisplayName("a banned user can still vote, with anonymous weight")
    void bannedUserVotesAnonymously() throws Exception {
        Track track = testData.track().withTitle("Vote me").complete().build();
        ban(contributor);
        mockMvc.perform(post("/api/tracks/" + track.getId() + "/feedback")
                .with(jwt.userToken(contributor.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"suggestedStyle\":\"Vals\"}"))
            .andExpect(status().isOk());
        assertThat(dsl.select(TRACK_STYLE_VOTES.WEIGHT).from(TRACK_STYLE_VOTES)
            .where(TRACK_STYLE_VOTES.TRACK_ID.eq(track.getId())).fetchOne(TRACK_STYLE_VOTES.WEIGHT))
            .isEqualByComparingTo("0.3");
    }

    @Nested
    @DisplayName("Admin review")
    class AdminReview {

        @Test
        @DisplayName("lists user additions but not the admin's own")
        void listsOnlyOtherUsersAdditions() throws Exception {
            submit(contributor, YOUTUBE_URL, "Polska", null);
            mockMvc.perform(post("/api/contributions/tracks")
                .with(jwt.adminToken(admin.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(trackBody(SPOTIFY_URL, "Vals", null)));

            mockMvc.perform(get("/api/admin/contributions/count").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tracks").value(1));
            mockMvc.perform(get("/api/admin/contributions").with(jwt.adminToken(admin.getId())))
                .andExpect(jsonPath("$.tracks", hasSize(1)))
                .andExpect(jsonPath("$.tracks[0].username").value("contributor"));
        }

        @Test
        @DisplayName("regular users cannot see the queue")
        void regularUserIsForbidden() throws Exception {
            mockMvc.perform(get("/api/admin/contributions").with(jwt.userToken(contributor.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("approve clears the track from the queue, remove deletes it")
        void approveAndRemove() throws Exception {
            submit(contributor, YOUTUBE_URL, "Polska", null);
            submit(contributor, "https://youtu.be/aaaaaaaaaaa", "Vals", null);
            var submissions = dsl.selectFrom(TRACK_SUBMISSIONS).orderBy(TRACK_SUBMISSIONS.EXTERNAL_ID).fetch();
            UUID keep = submissions.get(0).get(TRACK_SUBMISSIONS.ID);
            UUID drop = submissions.get(1).get(TRACK_SUBMISSIONS.ID);
            UUID droppedTrack = submissions.get(1).get(TRACK_SUBMISSIONS.TRACK_ID);

            mockMvc.perform(post("/api/admin/contributions/tracks/" + keep + "/approve").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isNoContent());
            mockMvc.perform(post("/api/admin/contributions/tracks/" + drop + "/remove").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isNoContent());

            assertThat(dsl.fetchExists(TRACKS, TRACKS.ID.eq(droppedTrack))).isFalse();
            mockMvc.perform(get("/api/admin/contributions/count").with(jwt.adminToken(admin.getId())))
                .andExpect(jsonPath("$.tracks").value(0));
        }

        @Test
        @DisplayName("removing a style hides it from the style tree")
        void removeStyle() throws Exception {
            mockMvc.perform(post("/api/contributions/styles")
                .with(jwt.userToken(contributor.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Masurka\"}"));
            UUID styleId = dsl.select(STYLE_KEYWORDS.ID).from(STYLE_KEYWORDS)
                .where(STYLE_KEYWORDS.MAIN_STYLE.eq("Masurka")).fetchOne(STYLE_KEYWORDS.ID);

            mockMvc.perform(get("/api/admin/contributions").with(jwt.adminToken(admin.getId())))
                .andExpect(jsonPath("$.styles[0].mainStyle").value("Masurka"));
            mockMvc.perform(post("/api/admin/contributions/styles/" + styleId + "/remove").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/styles/tree"))
                .andExpect(jsonPath("$[?(@.name == 'Masurka')]", hasSize(0)));
        }

        @Test
        @DisplayName("an admin can ban and unban a user, but not another admin")
        void banAndUnban() throws Exception {
            mockMvc.perform(post("/api/admin/users/" + contributor.getId() + "/ban").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isNoContent());
            assertThat(submit(contributor, YOUTUBE_URL, "Polska", null).getResponse().getStatus()).isEqualTo(403);

            mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                    .delete("/api/admin/users/" + contributor.getId() + "/ban").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isNoContent());
            assertThat(submit(contributor, YOUTUBE_URL, "Polska", null).getResponse().getStatus()).isEqualTo(200);

            mockMvc.perform(post("/api/admin/users/" + admin.getId() + "/ban").with(jwt.adminToken(admin.getId())))
                .andExpect(status().isBadRequest());
        }
    }
}
