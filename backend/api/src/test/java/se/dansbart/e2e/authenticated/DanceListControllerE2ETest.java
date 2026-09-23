package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.artist.Artist;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * E2E tests for DanceListController authenticated endpoints.
 */
class DanceListControllerE2ETest extends AbstractE2ETest {

    private static final UUID OWNER_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID OTHER_USER_ID = UUID.fromString("10000000-0000-0000-0000-000000000002");

    private User owner;
    private User otherUser;
    private Artist artist;
    private static final UUID DANCE_ID = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        owner = testData.user().withId(OWNER_ID).withUsername("dance_list_owner").build();
        otherUser = testData.user().withId(OTHER_USER_ID).withUsername("other_user").build();
        artist = testData.artist().withName("Test Artist").verified().build();
        testData.dance().withId(DANCE_ID).withName("Test Dance").withSlug("test-dance").build();
    }

    @Nested
    @DisplayName("POST /api/dance-lists")
    class CreateAndViewDanceList {

        @Test
        @DisplayName("should create dance list for authenticated user")
        void createDanceList_shouldCreateForAuthUser() throws Exception {
            mockMvc.perform(post("/api/dance-lists")
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "My Dance List"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("My Dance List"))
                .andExpect(jsonPath("$.userId").value(owner.getId().toString()));
        }

        @Test
        @DisplayName("should return 401 without authentication")
        void createDanceList_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(post("/api/dance-lists")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "My Dance List"))))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("create dance list for group by member with permission should return 201")
        void createDanceList_forGroup_byMemberWithPermission_shouldReturn201() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);

            mockMvc.perform(post("/api/dance-lists")
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Group Dance List", "groupId", group.getId().toString()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Group Dance List"))
                .andExpect(jsonPath("$.groupId").value(group.getId().toString()));
        }

        @Test
        @DisplayName("create dance list for group by member without permission should return 403")
        void createDanceList_forGroup_byMemberWithoutPermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, false, false, false);

            mockMvc.perform(post("/api/dance-lists")
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Group Dance List", "groupId", group.getId().toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("create dance list for group by non-member should return 404")
        void createDanceList_forGroup_byNonMember_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Test Group").build();

            mockMvc.perform(post("/api/dance-lists")
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Group Dance List", "groupId", group.getId().toString()))))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/dance-lists")
    class GetMyDanceLists {

        @Test
        @DisplayName("should return user's own dance lists")
        void getMyDanceLists_shouldReturnOwnDanceLists() throws Exception {
            createDanceList("Dance List 1", owner);
            createDanceList("Dance List 2", owner);
            createDanceList("Other User's Dance List", otherUser);

            mockMvc.perform(get("/api/dance-lists")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].name", containsInAnyOrder("Dance List 1", "Dance List 2")));
        }
    }

    @Nested
    @DisplayName("GET /api/dance-lists/{id}")
    class GetDanceList {

        @Test
        @DisplayName("should return dance list by ID for owner")
        void getDanceList_shouldReturnForOwner() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(danceListId))
                .andExpect(jsonPath("$.name").value("Test Dance List"));
        }

        @Test
        @DisplayName("owner should see share token in response")
        void getDanceList_byOwner_showsShareToken() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").exists());
        }

        @Test
        @DisplayName("edit collaborator should see share token in response")
        void getDanceList_byEditCollaborator_showsShareToken() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");
            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").exists());
        }

        @Test
        @DisplayName("view collaborator should not see share token in response")
        void getDanceList_byViewCollaborator_shouldNotExposeShareToken() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");
            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").doesNotExist());
        }

        @Test
        @DisplayName("should return 404 for non-existent dance list")
        void getDanceList_withInvalidId_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/dance-lists/{id}", "00000000-0000-0000-0000-000000000000")
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("private dance list by non-owner should return 404")
        void getDanceList_privateList_byNonOwner_shouldReturn404() throws Exception {
            String danceListId = createDanceList("Private Dance List", owner);

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("public dance list by any logged-in user should return 200")
        void getDanceList_publicList_byAnyLoggedInUser_shouldReturn200() throws Exception {
            String danceListId = createPublicDanceList("Public Dance List", owner);

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(danceListId));
        }

        @Test
        @DisplayName("owner sees viewerCanManage as true")
        void getDanceList_owner_viewerCanManageIsTrue() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(true));
        }

        @Test
        @DisplayName("edit collaborator sees viewerCanManage as true")
        void getDanceList_editCollaborator_viewerCanManageIsTrue() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(true));
        }

        @Test
        @DisplayName("view collaborator sees viewerCanManage as false")
        void getDanceList_viewCollaborator_viewerCanManageIsFalse() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(false));
        }

        @Test
        @DisplayName("group member with manage permission sees viewerCanManage as true")
        void getDanceList_groupMemberWithPermission_viewerCanManageIsTrue() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewerCanManage").value(true));
        }

        @Test
        @DisplayName("share token route has viewerCanManage absent or null")
        void getDanceList_shareToken_viewerCanManageIsNull() throws Exception {
            String danceListId = createDanceList("Test Dance List", owner);
            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());

            var getResult = mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andReturn();
            String getContent = getResult.getResponse().getContentAsString();
            String shareToken = fromJson(getContent, java.util.Map.class).get("shareToken").toString();

            var result = mockMvc.perform(get("/api/dance-lists/share/{shareToken}", shareToken))
                    .andExpect(status().isOk())
                    .andReturn();
            String content = result.getResponse().getContentAsString();
            Object viewerCanManage = fromJson(content, java.util.Map.class).get("viewerCanManage");
            org.junit.jupiter.api.Assertions.assertNull(viewerCanManage);
        }
    }

    @Nested
    @DisplayName("POST /api/dance-lists/{id}/entries")
    class AddEntry {

        @Test
        @DisplayName("should add entry with dance ID")
        void addEntry_withDanceId_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.danceId").value(DANCE_ID.toString()))
                .andExpect(jsonPath("$.position").value(0));
        }

        @Test
        @DisplayName("should add entry with free text name")
        void addEntry_withFreeTextName_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("freeTextName", "Custom Dance"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.freeTextName").value("Custom Dance"))
                .andExpect(jsonPath("$.position").value(0));
        }

        @Test
        @DisplayName("should return 409 when adding same dance twice")
        void addEntry_sameDanceTwice_shouldReturn409() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            addEntryWithDance(danceListId, DANCE_ID, owner);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("should return 400 when neither danceId nor freeTextName provided")
        void addEntry_withoutDanceIdOrName_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of())))
                .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("DELETE /api/dance-lists/{id}/entries/{entryId}")
    class RemoveEntry {

        @Test
        @DisplayName("should remove entry from dance list")
        void removeEntry_shouldRemoveFromDanceList() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());
        }
    }

    @Nested
    @DisplayName("PUT /api/dance-lists/{id}/entries/order")
    class ReorderEntries {

        @Test
        @DisplayName("should reorder entries in dance list")
        void reorderEntries_shouldReorder() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entry1Id = addEntryWithFreeText(danceListId, "Dance 1", owner);
            String entry2Id = addEntryWithFreeText(danceListId, "Dance 2", owner);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/order", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("entryIds", List.of(entry2Id, entry1Id)))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("should not move entry from another list")
        void reorderEntries_withEntryFromAnotherList_shouldNotMoveIt() throws Exception {
            String danceListA = createDanceList("Dance List A", owner);
            String danceListB = createDanceList("Dance List B", otherUser);
            String entryA1 = addEntryWithFreeText(danceListA, "Dance A1", owner);
            String entryA2 = addEntryWithFreeText(danceListA, "Dance A2", owner);
            String entryB1 = addEntryWithFreeText(danceListB, "Dance B1", otherUser);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/order", danceListA)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("entryIds", List.of(entryB1, entryA1, entryA2)))))
                .andExpect(status().isNotFound());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListB)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.entries", hasSize(1)))
                .andExpect(jsonPath("$.entries[0].id").value(entryB1));
        }
    }

    @Nested
    @DisplayName("PUT /api/dance-lists/{id}/entries/{entryId}")
    class SetPlayMode {

        @Test
        @DisplayName("should set play mode to in_order")
        void setPlayMode_inOrder_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("playMode", "in_order"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("should set play mode to random")
        void setPlayMode_random_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("playMode", "random"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("should reject invalid play mode with 400")
        void setPlayMode_invalid_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("playMode", "invalid_mode"))))
                .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("POST /api/dance-lists/{id}/entries/{entryId}/tracks")
    class AddTrackToEntry {

        @Test
        @DisplayName("should link track to entry with dance")
        void addTrack_shouldLinkTrack() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId().toString()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.trackId").value(track.getId().toString()))
                .andExpect(jsonPath("$.position").value(0));
        }

        @Test
        @DisplayName("should link track to entry in position order")
        void addTrack_multipleTracksInOrder_shouldOrganizeByPosition() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track1 = testData.track().withTitle("Track 1").withArtist(artist).complete().build();
            Track track2 = testData.track().withTitle("Track 2").withArtist(artist).complete().build();

            addTrackToEntry(danceListId, entryId, track1.getId(), owner);
            mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track2.getId().toString()))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.position").value(1));
        }
    }

    @Nested
    @DisplayName("DELETE /api/dance-lists/{id}/entries/{entryId}/tracks/{trackId}")
    class RemoveTrackFromEntry {

        @Test
        @DisplayName("should remove track from entry")
        void removeTrack_shouldRemove() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}/tracks/{trackId}",
                        danceListId, entryId, track.getId().toString())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());
        }
    }

    @Nested
    @DisplayName("PUT /api/dance-lists/{id}/entries/{entryId}/tracks/order")
    class ReorderTracksInEntry {

        @Test
        @DisplayName("should reorder tracks in entry")
        void reorderTracks_shouldReorder() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track1 = testData.track().withTitle("Track 1").withArtist(artist).complete().build();
            Track track2 = testData.track().withTitle("Track 2").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track1.getId(), owner);
            addTrackToEntry(danceListId, entryId, track2.getId(), owner);

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}/tracks/order",
                        danceListId, entryId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackIds",
                        List.of(track2.getId().toString(), track1.getId().toString())))))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("Votes")
    class Votes {

        @Test
        @DisplayName("linking track to entry with dance casts linking person's vote")
        void addTrack_castVote_shouldConfirmTrack() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));

            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));
        }

        @Test
        @DisplayName("unlinking track from entry withdraws vote")
        void removeTrack_withdrawVote_shouldWithdraw() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();

            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));

            removeTrackFromEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));
        }

        @Test
        @DisplayName("deleting entry withdraws vote")
        void deleteEntry_withdrawVote_shouldWithdraw() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();

            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));

            removeEntry(danceListId, entryId, owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));
        }

        @Test
        @DisplayName("deleting dance list withdraws votes")
        void deleteDanceList_withdrawVotes_shouldWithdraw() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();

            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));

            deleteDanceList(danceListId, owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));
        }

        @Test
        @DisplayName("deleting dance list with multiple links withdraws all votes")
        void deleteDanceList_withMultipleLinks_withdrawsAllVotes() throws Exception {
            UUID secondDanceId = UUID.fromString("20000000-0000-0000-0000-000000000002");
            testData.dance().withId(secondDanceId).withName("Second Dance").withSlug("second-dance").build();
            String danceListId = createDanceList("My Dance List", owner);
            String entry1Id = addEntryWithDance(danceListId, DANCE_ID, owner);
            String entry2Id = addEntryWithDance(danceListId, secondDanceId, owner);
            Track track1 = testData.track().withTitle("Track 1").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();
            Track track2 = testData.track().withTitle("Track 2").withArtist(artist).complete()
                .withDanceStyle("Hambo").build();

            addTrackToEntry(danceListId, entry1Id, track1.getId(), owner);
            addTrackToEntry(danceListId, entry2Id, track2.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));
            mockMvc.perform(get("/api/dances/{id}", secondDanceId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(1));

            deleteDanceList(danceListId, owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));
            mockMvc.perform(get("/api/dances/{id}", secondDanceId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedTrackCount").value(0));
        }

        @Test
        @DisplayName("linking track to typed entry casts no vote")
        void addTrack_toTypedEntry_castNoVote() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithFreeText(danceListId, "Custom Dance", owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();

            addTrackToEntry(danceListId, entryId, track.getId(), owner);

            mockMvc.perform(get("/api/dances/{id}", DANCE_ID)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("Permissions")
    class Permissions {

        @Test
        @DisplayName("edit collaborator may add entries")
        void editCollaborator_canAddEntries() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("view collaborator may not add entries")
        void viewCollaborator_cannotAddEntries() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("pending collaborator may not add entries")
        void pendingCollaborator_cannotAddEntries() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addPendingDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("group member with manage permission may add entries")
        void groupMemberWithManagePermission_canManageEntries() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("group member without manage permission may not add entries")
        void groupMemberWithoutManagePermission_cannotManageEntries() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may update list")
        void updateList_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("Original Name", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("view collaborator may not update list")
        void updateList_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("Original Name", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may not delete list")
        void deleteList_editCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("List To Delete", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(delete("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("view collaborator may not delete list")
        void deleteList_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("List To Delete", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(delete("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may remove entry")
        void removeEntry_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("view collaborator may not remove entry")
        void removeEntry_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may reorder entries")
        void reorderEntries_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entry1Id = addEntryWithFreeText(danceListId, "Dance 1", owner);
            String entry2Id = addEntryWithFreeText(danceListId, "Dance 2", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/order", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("entryIds", List.of(entry2Id, entry1Id)))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("view collaborator may not reorder entries")
        void reorderEntries_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entry1Id = addEntryWithFreeText(danceListId, "Dance 1", owner);
            String entry2Id = addEntryWithFreeText(danceListId, "Dance 2", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/order", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("entryIds", List.of(entry2Id, entry1Id)))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may set play mode")
        void setPlayMode_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("playMode", "random"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("view collaborator may not set play mode")
        void setPlayMode_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("playMode", "random"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may link track")
        void linkTrack_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId().toString()))))
                .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("view collaborator may not link track")
        void linkTrack_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackId", track.getId().toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may unlink track")
        void unlinkTrack_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track.getId(), owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}/tracks/{trackId}",
                        danceListId, entryId, track.getId().toString())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("view collaborator may not unlink track")
        void unlinkTrack_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track = testData.track().withTitle("Test Track").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track.getId(), owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}/tracks/{trackId}",
                        danceListId, entryId, track.getId().toString())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("edit collaborator may reorder tracks")
        void reorderTracks_editCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track1 = testData.track().withTitle("Track 1").withArtist(artist).complete().build();
            Track track2 = testData.track().withTitle("Track 2").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track1.getId(), owner);
            addTrackToEntry(danceListId, entryId, track2.getId(), owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}/tracks/order",
                        danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackIds",
                        List.of(track2.getId().toString(), track1.getId().toString())))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("view collaborator may not reorder tracks")
        void reorderTracks_viewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            String entryId = addEntryWithDance(danceListId, DANCE_ID, owner);
            Track track1 = testData.track().withTitle("Track 1").withArtist(artist).complete().build();
            Track track2 = testData.track().withTitle("Track 2").withArtist(artist).complete().build();
            addTrackToEntry(danceListId, entryId, track1.getId(), owner);
            addTrackToEntry(danceListId, entryId, track2.getId(), owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/entries/{entryId}/tracks/order",
                        danceListId, entryId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("trackIds",
                        List.of(track2.getId().toString(), track1.getId().toString())))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("group member with manage permission may update list")
        void updateList_groupMemberWithPermission_shouldSucceed() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("group member without manage permission may not update list")
        void updateList_groupMemberWithoutPermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);
            testData.addGroupMember(group, otherUser, false, false, false, false, false);

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("outsider may not update list")
        void updateList_outsider_shouldReturn404() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("pending collaborator may not update list")
        void updateList_pendingCollaborator_shouldReturn404() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addPendingDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Updated Name"))))
                .andExpect(status().isNotFound());
        }
    }


    // Helper methods

    private String createDanceList(String name, User owner) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists")
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", name))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private String createPublicDanceList(String name, User owner) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists")
                .with(jwt.userToken(owner.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", name, "isPublic", true))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private String createGroupDanceList(String name, Group group, User user) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists")
                .with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", name, "groupId", group.getId().toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private String addEntryWithDance(String danceListId, UUID danceId, User user) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                .with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("danceId", danceId.toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private String addEntryWithFreeText(String danceListId, String text, User user) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                .with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("freeTextName", text))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private String addTrackToEntry(String danceListId, String entryId, UUID trackId, User user) throws Exception {
        var response = mockMvc.perform(post("/api/dance-lists/{id}/entries/{entryId}/tracks", danceListId, entryId)
                .with(jwt.userToken(user.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("trackId", trackId.toString()))))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return extractIdFromResponse(response);
    }

    private void removeTrackFromEntry(String danceListId, String entryId, UUID trackId, User user) throws Exception {
        mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}/tracks/{trackId}",
                    danceListId, entryId, trackId.toString())
                .with(jwt.userToken(user.getId())))
            .andExpect(status().isNoContent());
    }

    private void removeEntry(String danceListId, String entryId, User user) throws Exception {
        mockMvc.perform(delete("/api/dance-lists/{id}/entries/{entryId}", danceListId, entryId)
                .with(jwt.userToken(user.getId())))
            .andExpect(status().isNoContent());
    }

    private void deleteDanceList(String danceListId, User user) throws Exception {
        mockMvc.perform(delete("/api/dance-lists/{id}", danceListId)
                .with(jwt.userToken(user.getId())))
            .andExpect(status().isNoContent());
    }

    private String extractIdFromResponse(String responseContent) throws Exception {
        return fromJson(responseContent, java.util.Map.class).get("id").toString();
    }

    @Nested
    @DisplayName("POST /api/dance-lists/{id}/collaborators")
    class Collaborators {

        @Test
        @DisplayName("owner should be able to invite collaborator")
        void inviteCollaborator_byOwner_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", otherUser.getId(), "permission", "edit"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(otherUser.getId().toString()))
                .andExpect(jsonPath("$.permission").value("edit"));
        }

        @Test
        @DisplayName("edit collaborator should not be able to invite collaborator")
        void inviteCollaborator_byEditCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");
            UUID thirdUserId = UUID.fromString("10000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", thirdUser.getId(), "permission", "edit"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("owner cannot invite self")
        void inviteCollaborator_invitingSelf_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", owner.getId(), "permission", "edit"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("owner cannot invite same person twice")
        void inviteCollaborator_invitingSamePerson_shouldReturn409() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", otherUser.getId(), "permission", "edit"))))
                .andExpect(status().isOk());

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", otherUser.getId(), "permission", "view"))))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("invite collaborator with unknown permission should return 400")
        void inviteCollaborator_withUnknownPermission_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", otherUser.getId(), "permission", "admin"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("owner should see pending collaborator in collaborator list")
        void getCollaborators_shouldShowPendingInvitation() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", otherUser.getId(), "permission", "edit"))))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/dance-lists/{id}/collaborators", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].userId", hasItem(otherUser.getId().toString())))
                .andExpect(jsonPath("$[?(@.userId == '" + otherUser.getId().toString() + "')].status").value("pending"));
        }

        @Test
        @DisplayName("invited person should accept invitation")
        void respondToInvitation_accept_shouldBecomeAcceptedCollaborator() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addPendingDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators/respond", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", true))))
                .andExpect(status().isOk());

            mockMvc.perform(post("/api/dance-lists/{id}/entries", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("danceId", DANCE_ID.toString()))))
                .andExpect(status().isCreated());
        }

        @Test
        @DisplayName("invited person should decline invitation")
        void respondToInvitation_decline_shouldRemoveInvitation() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addPendingDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators/respond", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", false))))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("non-invited person cannot respond to invitation")
        void respondToInvitation_notInvited_shouldReturn404() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            UUID thirdUserId = UUID.fromString("10000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();

            mockMvc.perform(post("/api/dance-lists/{id}/collaborators/respond", danceListId)
                    .with(jwt.userToken(thirdUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", true))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("owner should be able to update collaborator permission")
        void updateCollaborator_byOwner_shouldChangesPermission() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/collaborators/{userId}", danceListId, otherUser.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("permission", "edit"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permission").value("edit"));
        }

        @Test
        @DisplayName("update collaborator with unknown permission should return 400")
        void updateCollaborator_withUnknownPermission_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/collaborators/{userId}", danceListId, otherUser.getId())
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("permission", "admin"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("edit collaborator should not be able to update collaborator permission")
        void updateCollaborator_byEditCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");
            UUID thirdUserId = UUID.fromString("10000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();
            testData.addDanceListCollaborator(danceListId, thirdUser, "view");

            mockMvc.perform(put("/api/dance-lists/{id}/collaborators/{userId}", danceListId, thirdUser.getId())
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("permission", "edit"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("owner should be able to remove collaborator")
        void removeCollaborator_byOwner_shouldRemove() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(delete("/api/dance-lists/{id}/collaborators/{userId}", danceListId, otherUser.getId())
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("edit collaborator should not be able to remove collaborator")
        void removeCollaborator_byEditCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");
            UUID thirdUserId = UUID.fromString("10000000-0000-0000-0000-000000000003");
            User thirdUser = testData.user().withId(thirdUserId).withUsername("third_user").build();
            testData.addDanceListCollaborator(danceListId, thirdUser, "view");

            mockMvc.perform(delete("/api/dance-lists/{id}/collaborators/{userId}", danceListId, thirdUser.getId())
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("Share link")
    class Sharing {

        @Test
        @DisplayName("owner should be able to generate share token")
        void generateShareToken_byOwner_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").isNotEmpty());
        }

        @Test
        @DisplayName("edit collaborator should be able to generate share token")
        void generateShareToken_byEditCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.shareToken").isNotEmpty());
        }

        @Test
        @DisplayName("view collaborator should not be able to generate share token")
        void generateShareToken_byViewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");

            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("owner should be able to invalidate share token")
        void invalidateShareToken_byOwner_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            var shareTokenResponse = mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
            String shareToken = fromJson(shareTokenResponse, java.util.Map.class).get("shareToken").toString();

            mockMvc.perform(delete("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/dance-lists/share/{shareToken}", shareToken))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("edit collaborator should be able to invalidate share token")
        void invalidateShareToken_byEditCollaborator_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");
            var shareTokenResponse = mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
            String shareToken = fromJson(shareTokenResponse, java.util.Map.class).get("shareToken").toString();

            mockMvc.perform(delete("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/dance-lists/share/{shareToken}", shareToken))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("view collaborator should not be able to invalidate share token")
        void invalidateShareToken_byViewCollaborator_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "view");
            mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk());

            mockMvc.perform(delete("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(otherUser.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("anyone should be able to access dance list by share token without auth")
        void getByShareToken_shouldReturnDanceList() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            var shareTokenResponse = mockMvc.perform(post("/api/dance-lists/{id}/share-token", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
            String shareToken = fromJson(shareTokenResponse, java.util.Map.class).get("shareToken").toString();

            mockMvc.perform(get("/api/dance-lists/share/{shareToken}", shareToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("My Dance List"))
                .andExpect(jsonPath("$.shareToken").value(shareToken));
        }

        @Test
        @DisplayName("invalid share token should return 404")
        void getByShareToken_withInvalidToken_shouldReturn404() throws Exception {
            mockMvc.perform(get("/api/dance-lists/share/{shareToken}", "invalid-token"))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PUT /api/dance-lists/{id}/transfer-ownership")
    class Transfer {

        @Test
        @DisplayName("owner should be able to transfer ownership to accepted collaborator")
        void transferOwnership_byOwner_shouldSucceed() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/transfer-ownership", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(otherUser.getId().toString()));
        }

        @Test
        @DisplayName("non-owner should not be able to transfer ownership")
        void transferOwnership_byNonOwner_shouldReturn403() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/transfer-ownership", danceListId)
                    .with(jwt.userToken(otherUser.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("group-owned dance list should refuse transfer")
        void transferOwnership_groupOwnedList_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Test Group").build();
            testData.addGroupMember(group, owner, false, false, true, false, false);
            String danceListId = createGroupDanceList("Group Dance List", group, owner);

            mockMvc.perform(put("/api/dance-lists/{id}/transfer-ownership", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("transfer ownership to person who is not an accepted collaborator should return 400")
        void transferOwnership_toPersonWhoIsNotAnAcceptedCollaborator_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);

            mockMvc.perform(put("/api/dance-lists/{id}/transfer-ownership", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isBadRequest());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner.id").value(owner.getId().toString()));
        }

        @Test
        @DisplayName("transfer ownership to pending invitee should return 400")
        void transferOwnership_toPendingInvitee_shouldReturn400() throws Exception {
            String danceListId = createDanceList("My Dance List", owner);
            testData.addPendingDanceListCollaborator(danceListId, otherUser, "edit");

            mockMvc.perform(put("/api/dance-lists/{id}/transfer-ownership", danceListId)
                    .with(jwt.userToken(owner.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("newOwnerId", otherUser.getId().toString()))))
                .andExpect(status().isBadRequest());

            mockMvc.perform(get("/api/dance-lists/{id}", danceListId)
                    .with(jwt.userToken(owner.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owner.id").value(owner.getId().toString()));
        }
    }
}
