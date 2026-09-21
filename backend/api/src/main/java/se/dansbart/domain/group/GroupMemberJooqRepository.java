package se.dansbart.domain.group;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;
import se.dansbart.domain.user.User;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.GROUP_MEMBERS;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class GroupMemberJooqRepository {

    private final DSLContext dsl;

    public GroupMemberJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<GroupMember> findByGroupIdAndUserId(UUID groupId, UUID userId) {
        return dsl.selectFrom(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.GROUP_ID.eq(groupId).and(GROUP_MEMBERS.USER_ID.eq(userId)))
            .fetchOptional(this::toMember);
    }

    public List<GroupMember> findByGroupId(UUID groupId) {
        return dsl.select()
            .from(GROUP_MEMBERS)
            .leftJoin(USERS).on(USERS.ID.eq(GROUP_MEMBERS.USER_ID))
            .where(GROUP_MEMBERS.GROUP_ID.eq(groupId))
            .orderBy(GROUP_MEMBERS.INVITED_AT.asc())
            .fetch(this::toMemberWithUser);
    }

    public GroupMember save(GroupMember member) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(GROUP_MEMBERS)
            .columns(
                GROUP_MEMBERS.ID,
                GROUP_MEMBERS.GROUP_ID,
                GROUP_MEMBERS.USER_ID,
                GROUP_MEMBERS.IS_ADMIN,
                GROUP_MEMBERS.CAN_EDIT_INFO,
                GROUP_MEMBERS.CAN_MANAGE_PLAYLISTS,
                GROUP_MEMBERS.CAN_INVITE_MEMBERS,
                GROUP_MEMBERS.CAN_REMOVE_MEMBERS,
                GROUP_MEMBERS.STATUS,
                GROUP_MEMBERS.INVITED_BY,
                GROUP_MEMBERS.ACCEPTED_AT
            )
            .values(
                id,
                member.getGroupId(),
                member.getUserId(),
                member.getIsAdmin(),
                member.getCanEditInfo(),
                member.getCanManagePlaylists(),
                member.getCanInviteMembers(),
                member.getCanRemoveMembers(),
                member.getStatus(),
                member.getInvitedBy(),
                member.getAcceptedAt()
            )
            .execute();
        member.setId(id);
        return member;
    }

    private GroupMember toMember(Record r) {
        return GroupMember.builder()
            .id(r.get(GROUP_MEMBERS.ID))
            .groupId(r.get(GROUP_MEMBERS.GROUP_ID))
            .userId(r.get(GROUP_MEMBERS.USER_ID))
            .isAdmin(Boolean.TRUE.equals(r.get(GROUP_MEMBERS.IS_ADMIN)))
            .canEditInfo(Boolean.TRUE.equals(r.get(GROUP_MEMBERS.CAN_EDIT_INFO)))
            .canManagePlaylists(Boolean.TRUE.equals(r.get(GROUP_MEMBERS.CAN_MANAGE_PLAYLISTS)))
            .canInviteMembers(Boolean.TRUE.equals(r.get(GROUP_MEMBERS.CAN_INVITE_MEMBERS)))
            .canRemoveMembers(Boolean.TRUE.equals(r.get(GROUP_MEMBERS.CAN_REMOVE_MEMBERS)))
            .status(r.get(GROUP_MEMBERS.STATUS))
            .invitedBy(r.get(GROUP_MEMBERS.INVITED_BY))
            .invitedAt(r.get(GROUP_MEMBERS.INVITED_AT))
            .acceptedAt(r.get(GROUP_MEMBERS.ACCEPTED_AT))
            .build();
    }

    private GroupMember toMemberWithUser(Record r) {
        GroupMember member = toMember(r);
        String username = r.get(USERS.USERNAME);
        if (username != null) {
            User user = new User();
            user.setId(r.get(USERS.ID));
            user.setUsername(username);
            user.setDisplayName(r.get(USERS.DISPLAY_NAME));
            user.setAvatarUrl(r.get(USERS.AVATAR_URL));
            member.setUser(user);
        }
        return member;
    }
}
