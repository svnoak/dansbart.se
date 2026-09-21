package se.dansbart.e2e.authenticated;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import se.dansbart.domain.group.Group;
import se.dansbart.domain.user.User;
import se.dansbart.e2e.base.AbstractE2ETest;

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
}
