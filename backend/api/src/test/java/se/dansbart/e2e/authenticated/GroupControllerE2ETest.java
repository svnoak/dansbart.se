package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.group.GroupMember;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
                .andExpect(jsonPath("$.isPublic").value(true))
                .andExpect(jsonPath("$.members", hasSize(1)))
                .andExpect(jsonPath("$.members[0].isAdmin").value(true))
                .andExpect(jsonPath("$.members[0].userId").value(admin.getId().toString()));

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

        @Test
        @DisplayName("should return 400 with blank name")
        void createGroup_withBlankName_shouldReturn400() throws Exception {
            mockMvc.perform(post("/api/groups")
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "   "))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should return 400 without name field")
        void createGroup_withoutName_shouldReturn400() throws Exception {
            mockMvc.perform(post("/api/groups")
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of())))
                .andExpect(status().isBadRequest());
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
                .andExpect(jsonPath("$.name").value("Öppen grupp"))
                .andExpect(jsonPath("$.members").doesNotExist());
        }
    }

    @Nested
    @DisplayName("GET /api/groups/public")
    class GetPublicGroups {

        @Test
        @DisplayName("should return 200 for an anonymous request")
        void getPublicGroups_withoutAuth_shouldReturn200() throws Exception {
            testData.group().withName("Öppen grupp").isPublic().build();
            testData.group().withName("Privat grupp").build();

            mockMvc.perform(get("/api/groups/public"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name").value("Öppen grupp"));
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
                .andExpect(jsonPath("$.isPublic").value(true))
                .andExpect(jsonPath("$.members", notNullValue()))
                .andExpect(jsonPath("$.members", hasSize(greaterThan(0))));
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

        @Test
        @DisplayName("should return 400 with blank name and keep original name")
        void updateGroup_withBlankName_shouldReturn400() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "   "))))
                .andExpect(status().isBadRequest());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Original"));
        }

        @Test
        @DisplayName("member without canEditInfo should return 403")
        void updateGroup_byMemberWithoutPermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Uppdaterat namn"))))
                .andExpect(status().isForbidden());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Original"));
        }

        @Test
        @DisplayName("non-member on public group should return 403")
        void updateGroup_byOutsider_publicGroup_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Original").isPublic().build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Uppdaterat namn"))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("non-member on private group should return 404")
        void updateGroup_byOutsider_privateGroup_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "Uppdaterat namn"))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("outsider sending a blank name to a private group gets 404")
        void updateGroup_withBlankName_byOutsider_privateGroup_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Original").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(put("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("name", "   "))))
                .andExpect(status().isNotFound());
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
        @DisplayName("non-admin member should return 403")
        void deleteGroup_byNonAdminMember_shouldReturn403() throws Exception {
            Group group = testData.group().withName("To delete").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(delete("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isForbidden());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("unknown group should return 404")
        void deleteGroup_unknownGroup_shouldReturn404() throws Exception {
            UUID unknownId = UUID.randomUUID();

            mockMvc.perform(delete("/api/groups/{id}", unknownId)
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("Group membership")
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

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(2)));
        }

        @Test
        @DisplayName("non-admin member with canRemoveMembers can remove a plain member")
        void removeMember_byMemberWithRemovePermission_canRemovePlainMember() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, true);
            var outsiderMembership = testData.addGroupMember(group, outsider, false, false, false, false, false);

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
        @DisplayName("invited user can decline the invitation and becomes removed")
        void respondToInvitation_decline_shouldReturn204AndRemoveInvitation() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID invitationId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            mockMvc.perform(put("/api/groups/invitations/{id}", invitationId)
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", false))))
                .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/groups/invitations")
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(1)));
        }

        @Test
        @DisplayName("member without canInviteMembers cannot invite")
        void inviteMember_byMemberWithoutInvitePermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("outsider cannot invite in a private group")
        void inviteMember_byOutsider_privateGroup_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", member.getId().toString()))))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("cannot invite someone who is already a member")
        void inviteMember_alreadyMember_shouldReturn409() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", member.getId().toString()))))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("cannot invite someone who is already invited")
        void inviteMember_alreadyInvited_shouldReturn409() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk());

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("cannot invite self")
        void inviteMember_self_shouldReturn400() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", admin.getId().toString()))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("cannot invite unknown user")
        void inviteMember_unknownUser_shouldReturn400() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", UUID.randomUUID().toString()))))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("non-admin member cannot update permissions")
        void updateMemberPermissions_byNonAdminMember_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var memberMembership = testData.addGroupMember(group, member, false, false, false, false, false);
            var outsiderMembership = testData.addGroupMember(group, outsider, false, false, false, false, false);

            Map<String, Object> body = new HashMap<>();
            body.put("canManagePlaylists", true);

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), outsiderMembership.getId())
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("member without canRemoveMembers cannot remove a plain member")
        void removeMember_byMemberWithoutRemovePermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);
            var outsiderMembership = testData.addGroupMember(group, outsider, false, false, false, false, false);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), outsiderMembership.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("non-admin with remove permission cannot remove an admin")
        void removeMember_adminByNonAdminWithRemovePermission_shouldReturn403() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            GroupMember adminMembership = testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, true);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), adminMembership.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("outsider cannot remove members in a private group")
        void removeMember_byOutsider_privateGroup_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            var memberMembership = testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), memberMembership.getId())
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("cannot update permissions on a pending member")
        void updateMemberPermissions_onPendingMember_shouldReturn409() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID pendingMemberId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            Map<String, Object> body = new HashMap<>();
            body.put("canManagePlaylists", true);

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), pendingMemberId)
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("sole admin cannot remove themselves")
        void removeMember_lastAdminLeaving_shouldReturn409() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            var adminMembership = testData.addGroupAdmin(group, admin);

            mockMvc.perform(delete("/api/groups/{id}/members/{memberId}", group.getId(), adminMembership.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isConflict());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(1)));
        }

        @Test
        @DisplayName("sole admin cannot be demoted")
        void updateMemberPermissions_demotingLastAdmin_shouldReturn409() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            var adminMembership = testData.addGroupAdmin(group, admin);

            Map<String, Object> body = new HashMap<>();
            body.put("isAdmin", false);

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), adminMembership.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("member without invite permission cannot see pending invitations")
        void getGroup_byMemberWithoutInvitePermission_shouldHidePendingInvitations() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk());

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(member.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(2)));

            mockMvc.perform(get("/api/groups/{id}", group.getId())
                    .with(jwt.userToken(admin.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.members", hasSize(3)));
        }

        @Test
        @DisplayName("inviteMember_shouldReturnInviteeName")
        void inviteMember_shouldReturnInviteeName() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(outsider.getUsername()))
                .andExpect(jsonPath("$.username").isNotEmpty());
        }

        @Test
        @DisplayName("respondToInvitation_accept_shouldReturnMemberName")
        void respondToInvitation_accept_shouldReturnMemberName() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID invitationId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            mockMvc.perform(put("/api/groups/invitations/{id}", invitationId)
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value(outsider.getUsername()));
        }

        @Test
        @DisplayName("updateMemberPermissions_shouldReturnMemberName")
        void updateMemberPermissions_shouldReturnMemberName() throws Exception {
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
                .andExpect(jsonPath("$.username").value(member.getUsername()));
        }

        @Test
        @DisplayName("updateMemberPermissions_unknownMember_byNonAdmin_shouldReturn404")
        void updateMemberPermissions_unknownMember_byNonAdmin_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);
            testData.addGroupMember(group, member, false, false, false, false, false);

            Map<String, Object> body = new HashMap<>();
            body.put("canManagePlaylists", true);
            UUID unknownMemberId = UUID.randomUUID();

            mockMvc.perform(put("/api/groups/{id}/members/{memberId}", group.getId(), unknownMemberId)
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(body)))
                .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("respondToInvitation_withoutAcceptField_shouldReturn400AndKeepInvitation")
        void respondToInvitation_withoutAcceptField_shouldReturn400AndKeepInvitation() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID invitationId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            mockMvc.perform(put("/api/groups/invitations/{id}", invitationId)
                    .with(jwt.userToken(outsider.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of())))
                .andExpect(status().isBadRequest());

            mockMvc.perform(get("/api/groups/invitations")
                    .with(jwt.userToken(outsider.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
        }

        @Test
        @DisplayName("respondToInvitation_toSomeoneElsesInvitation_shouldReturn404")
        void respondToInvitation_toSomeoneElsesInvitation_shouldReturn404() throws Exception {
            Group group = testData.group().withName("Grupp").build();
            testData.addGroupAdmin(group, admin);

            String response = mockMvc.perform(post("/api/groups/{id}/members", group.getId())
                    .with(jwt.userToken(admin.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("userId", outsider.getId().toString()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            UUID invitationId = UUID.fromString(objectMapper.readTree(response).get("id").asText());

            mockMvc.perform(put("/api/groups/invitations/{id}", invitationId)
                    .with(jwt.userToken(member.getId()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(Map.of("accept", true))))
                .andExpect(status().isNotFound());
        }
    }
}
