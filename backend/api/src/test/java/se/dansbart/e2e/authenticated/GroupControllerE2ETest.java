package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.playlist.Playlist;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * E2E tests for GroupController authenticated endpoints.
 */
class GroupControllerE2ETest extends AbstractE2ETest {

    private static final UUID ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000010");
    private static final UUID MEMBER_ID = UUID.fromString("00000000-0000-0000-0000-000000000011");
    private static final UUID OUTSIDER_ID = UUID.fromString("00000000-0000-0000-0000-000000000012");

    private User admin;
    private User member;
    private User outsider;

    @BeforeEach
    void setUp() {
        admin = testData.user().withId(ADMIN_ID).withUsername("group_admin").build();
        member = testData.user().withId(MEMBER_ID).withUsername("group_member").build();
        outsider = testData.user().withId(OUTSIDER_ID).withUsername("outsider").build();
    }

    @Nested
    @DisplayName("POST /api/groups")
    class CreateGroup {

        @Test
        @DisplayName("should create group and make creator an admin")
        void createGroup_shouldCreateAndMakeCreatorAdmin() throws Exception {
            mockMvc.perform(post("/api/groups")
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Folkdanslaget", "aboutUs", "Vi dansar polska", "isPublic", true))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Folkdanslaget"))
                .andExpect(jsonPath("$.aboutUs").value("Vi dansar polska"))
                .andExpect(jsonPath("$.isPublic").value(true));

            mockMvc.perform(get("/api/groups")
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Folkdanslaget"))
                .andExpect(jsonPath("$[0].memberCount").value(1));
        }

        @Test
        @DisplayName("should return 401 without authentication")
        void createGroup_withoutAuth_shouldReturn401() throws Exception {
            mockMvc.perform(post("/api/groups")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Folkdanslaget"))))
                .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("GET /api/groups/{id}")
    class GetGroup {

        @Test
        @DisplayName("member can view a private group")
        void getGroup_byMember_shouldReturnGroup() throws Exception {
            Group group = testData.group().withName("Privat grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Privat grupp"))
                .andExpect(jsonPath("$.members", hasSize(1)));
        }

        @Test
        @DisplayName("non-member should get 404 for a private group")
        void getGroup_byNonMember_privateGroup_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Privat grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("any authenticated user can view a public group")
        void getGroup_byOutsider_publicGroup_shouldReturn200() throws Exception {
            Group group = testData.group().withName("Öppen grupp").isPublic().build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Öppen grupp"));
        }
    }

    @Nested
    @DisplayName("PUT /api/groups/{id}")
    class UpdateGroup {

        @Test
        @DisplayName("admin can update group info")
        void updateGroup_byAdmin_shouldSucceed() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Nytt namn", "aboutUs", "Ny beskrivning", "isPublic", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Nytt namn"))
                .andExpect(jsonPath("$.isPublic").value(true));
        }

        @Test
        @DisplayName("member without canEditInfo should get 404")
        void updateGroup_byMemberWithoutPermission_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Hacked"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("member with canEditInfo can update group info")
        void updateGroup_byMemberWithPermission_shouldSucceed() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, true, false, false, false);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Uppdaterat namn"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Uppdaterat namn"));
        }
    }

    @Nested
    @DisplayName("DELETE /api/groups/{id}")
    class DeleteGroup {

        @Test
        @DisplayName("admin can delete the group")
        void deleteGroup_byAdmin_shouldSucceed() throws Exception {
            Group group = testData.group().withName("To delete").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(delete("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("non-admin member cannot delete the group")
        void deleteGroup_byNonAdmin_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Keep me").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, true, true, true, true);

            mockMvc.perform(delete("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("Membership endpoints")
    class Membership {

        @Test
        @DisplayName("member with canInviteMembers can invite a new member")
        void inviteMember_byPermittedMember_shouldCreatePendingInvite() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, true, false);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("pending"));
        }

        @Test
        @DisplayName("member without canInviteMembers cannot invite")
        void inviteMember_byUnpermittedMember_shouldReturn400() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("invited user can accept the invitation and becomes a visible member")
        void respondToInvitation_accept_shouldAddMember() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID invitationId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            mockMvc.perform(get("/api/groups/invitations")
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].groupName").value("Grupp"));

            mockMvc.perform(put("/api/groups/invitations/{id}", invitationId)
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("accepted"));

            mockMvc.perform(get("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
        }

        @Test
        @DisplayName("admin can remove another admin, but not the last remaining admin")
        void removeMember_lastAdminGuard() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var secondAdmin = testData.addGroupAdmin(group, member);

            // Admin removes the second admin — allowed, one admin remains.
            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), secondAdmin.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isNoContent());

            // Find the remaining (only) membership row for the admin and try to remove it.
            String membersJson = mockMvc.perform(get("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID lastAdminMembershipId = UUID.fromString(objectMapper.readTree(membersJson).get(0).get("id").asText());

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), lastAdminMembershipId)
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("non-admin member with canRemoveMembers cannot remove an admin, but can remove a plain member")
        void removeMember_nonAdminCannotRemoveAdmin() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            var adminMembership = testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, true);
            var outsiderMembership = testData.addGroupMember(group, outsider, false, false, false, false, false);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), adminMembership.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isNotFound());

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), outsiderMembership.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("a member can remove themselves (leave)")
        void removeMember_self_shouldLeaveGroup() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var membership = testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), membership.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("admin can grant permissions to a member")
        void updateMemberPermissions_byAdmin_shouldSucceed() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var membership = testData.addGroupMember(group, member, false, false, false, false, false);

            Map<String, Object> body = new HashMap<>();
            body.put("canManagePlaylists", true);

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), membership.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canManagePlaylists").value(true));
        }

        @Test
        @DisplayName("non-admin cannot change another member's permissions")
        void updateMemberPermissions_byNonAdmin_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var membership1 = testData.addGroupMember(group, member, false, true, true, true, true);
            var membership2 = testData.addGroupMember(group, outsider, false, false, false, false, false);

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), membership2.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("canManagePlaylists", true))))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/groups/{id}/playlists")
    class CreateGroupPlaylist {

        @Test
        @DisplayName("member with canManagePlaylists can create a group playlist")
        void createPlaylist_byPermittedMember_shouldSucceed() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, true, false, false);

            mockMvc.perform(post("/api/groups/{id}/playlists", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Gruppens spellista", "description", "Låtar vi dansar till"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Gruppens spellista"))
                .andExpect(jsonPath("$.groupId").value(group.getId().toString()));
        }

        @Test
        @DisplayName("member without canManagePlaylists cannot create a group playlist")
        void createPlaylist_byUnpermittedMember_shouldReturn400() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(post("/api/groups/{id}/playlists", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Nope"))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("a group playlist appears in the group detail response")
        void groupPlaylist_appearsInGroupDetail() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            Playlist playlist = testData.playlist().withName("Gruppens lista").withGroup(group).build();

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.playlists", hasSize(1)))
                .andExpect(jsonPath("$.playlists[0].name").value("Gruppens lista"));
        }

        @Test
        @DisplayName("group admin can manage a group-owned playlist via the playlist endpoints")
        void groupAdmin_canEditGroupPlaylist() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            Playlist playlist = testData.playlist().withName("Original").withGroup(group).build();

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Uppdaterad", "isPublic", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Uppdaterad"))
                .andExpect(jsonPath("$.isPublic").value(true));
        }

        @Test
        @DisplayName("non-member cannot edit a group-owned playlist")
        void nonMember_cannotEditGroupPlaylist() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            Playlist playlist = testData.playlist().withName("Original").withGroup(group).build();

            mockMvc.perform(put("/api/playlists/{id}", playlist.getId())
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Hacked"))))
                .andExpect(status().isNotFound());
        }
    }
}
