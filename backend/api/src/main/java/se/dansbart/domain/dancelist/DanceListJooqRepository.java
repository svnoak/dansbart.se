package se.dansbart.domain.dancelist;

import org.jooq.Condition;
import org.jooq.Field;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.Record1;
import org.jooq.SelectConditionStep;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.coalesce;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.field;
import static se.dansbart.jooq.Tables.DANCE_LISTS;
import static se.dansbart.jooq.Tables.DANCE_LIST_ENTRIES;
import static se.dansbart.jooq.Tables.GROUPS;
import static se.dansbart.jooq.Tables.USERS;
import static se.dansbart.jooq.Tables.DANCE_LIST_COLLABORATORS;
import static se.dansbart.jooq.Tables.GROUP_MEMBERS;

@Repository
public class DanceListJooqRepository {

    private final DSLContext dsl;

    public DanceListJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceList> findById(UUID id) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.ID.eq(id)).fetchOptional(this::toDanceList);
    }

    public Optional<DanceList> findByShareToken(String shareToken) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.SHARE_TOKEN.eq(shareToken)).fetchOptional(this::toDanceList);
    }

    public List<DanceList> findByUserId(UUID userId) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.USER_ID.eq(userId)).orderBy(DANCE_LISTS.NAME.asc()).fetch(this::toDanceList);
    }

    /** Lists the user owns, lists of the user's groups and lists shared with the user or one of the user's groups. */
    public List<DanceList> findVisibleToUser(UUID userId) {
        return dsl.selectFrom(DANCE_LISTS)
            .where(DANCE_LISTS.USER_ID.eq(userId))
            .or(DANCE_LISTS.GROUP_ID.in(acceptedGroupsSubquery(userId, false)))
            .or(DANCE_LISTS.ID.in(individualCollaborationsSubquery(userId, null)))
            .or(DANCE_LISTS.ID.in(groupCollaborationsSubquery(userId, null)))
            .orderBy(DANCE_LISTS.NAME.asc())
            .fetch(this::toDanceList);
    }

    /** Lists the user may add dances to. */
    public List<DanceList> findEditableByUser(UUID userId) {
        return dsl.selectFrom(DANCE_LISTS)
            .where(DANCE_LISTS.USER_ID.eq(userId))
            .or(DANCE_LISTS.GROUP_ID.in(acceptedGroupsSubquery(userId, true)))
            .or(DANCE_LISTS.ID.in(individualCollaborationsSubquery(userId, "edit")))
            .or(DANCE_LISTS.ID.in(groupCollaborationsSubquery(userId, "edit")))
            .orderBy(DANCE_LISTS.NAME.asc())
            .fetch(this::toDanceList);
    }

    private SelectConditionStep<Record1<UUID>> acceptedGroupsSubquery(UUID userId, boolean managedOnly) {
        Condition condition = GROUP_MEMBERS.USER_ID.eq(userId).and(GROUP_MEMBERS.STATUS.eq("accepted"));
        if (managedOnly) {
            condition = condition.and(GROUP_MEMBERS.IS_ADMIN.isTrue().or(GROUP_MEMBERS.CAN_MANAGE_PLAYLISTS.isTrue()));
        }
        return dsl.select(GROUP_MEMBERS.GROUP_ID).from(GROUP_MEMBERS).where(condition);
    }

    private SelectConditionStep<Record1<UUID>> individualCollaborationsSubquery(UUID userId, String permission) {
        Condition condition = DANCE_LIST_COLLABORATORS.USER_ID.eq(userId)
            .and(DANCE_LIST_COLLABORATORS.STATUS.eq("accepted"));
        if (permission != null) {
            condition = condition.and(DANCE_LIST_COLLABORATORS.PERMISSION.eq(permission));
        }
        return dsl.select(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID).from(DANCE_LIST_COLLABORATORS).where(condition);
    }

    private SelectConditionStep<Record1<UUID>> groupCollaborationsSubquery(UUID userId, String permission) {
        Condition condition = DANCE_LIST_COLLABORATORS.GROUP_ID.in(acceptedGroupsSubquery(userId, false))
            .and(DANCE_LIST_COLLABORATORS.STATUS.eq("accepted"));
        if (permission != null) {
            condition = condition.and(DANCE_LIST_COLLABORATORS.PERMISSION.eq(permission));
        }
        return dsl.select(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID).from(DANCE_LIST_COLLABORATORS).where(condition);
    }

    public List<DanceList> findByGroupId(UUID groupId, boolean includePrivate) {
        var condition = includePrivate
            ? DANCE_LISTS.GROUP_ID.eq(groupId)
            : DANCE_LISTS.GROUP_ID.eq(groupId).and(DANCE_LISTS.IS_PUBLIC.isTrue());
        return dsl.selectFrom(DANCE_LISTS).where(condition).orderBy(DANCE_LISTS.NAME.asc()).fetch(this::toDanceList);
    }

    /** A public dance list with its number of dances and the names of its owner. */
    public record DanceListWithOwner(DanceList danceList, int entryCount, String groupName, String ownerDisplayName) {}

    public List<DanceListWithOwner> findPublic() {
        Field<Integer> entryCount = field(
            dsl.select(count()).from(DANCE_LIST_ENTRIES).where(DANCE_LIST_ENTRIES.DANCE_LIST_ID.eq(DANCE_LISTS.ID))
        ).as("entry_count");
        Field<String> ownerName = coalesce(USERS.DISPLAY_NAME, USERS.USERNAME).as("owner_display_name");
        return dsl.select(DANCE_LISTS.fields())
            .select(entryCount, GROUPS.NAME.as("group_name"), ownerName)
            .from(DANCE_LISTS)
            .leftJoin(GROUPS).on(DANCE_LISTS.GROUP_ID.eq(GROUPS.ID))
            .leftJoin(USERS).on(DANCE_LISTS.USER_ID.eq(USERS.ID))
            .where(DANCE_LISTS.IS_PUBLIC.isTrue())
            .orderBy(DANCE_LISTS.NAME.asc(), DANCE_LISTS.ID.asc())
            .fetch(r -> new DanceListWithOwner(
                toDanceList(r),
                r.get("entry_count", Integer.class),
                r.get("group_name", String.class),
                r.get("owner_display_name", String.class)));
    }

    public DanceList insert(DanceList danceList) {
        UUID id = danceList.getId() != null ? danceList.getId() : UUID.randomUUID();
        dsl.insertInto(DANCE_LISTS)
            .columns(DANCE_LISTS.ID, DANCE_LISTS.USER_ID, DANCE_LISTS.GROUP_ID, DANCE_LISTS.NAME, DANCE_LISTS.DESCRIPTION, DANCE_LISTS.IS_PUBLIC, DANCE_LISTS.SHARE_TOKEN)
            .values(id, danceList.getUserId(), danceList.getGroupId(), danceList.getName(), danceList.getDescription(), danceList.getIsPublic(), danceList.getShareToken())
            .execute();
        danceList.setId(id);
        return danceList;
    }

    public DanceList update(DanceList danceList) {
        dsl.update(DANCE_LISTS)
            .set(DANCE_LISTS.NAME, danceList.getName())
            .set(DANCE_LISTS.DESCRIPTION, danceList.getDescription())
            .set(DANCE_LISTS.IS_PUBLIC, danceList.getIsPublic())
            .set(DANCE_LISTS.SHARE_TOKEN, danceList.getShareToken())
            .set(DANCE_LISTS.UPDATED_AT, danceList.getUpdatedAt())
            .where(DANCE_LISTS.ID.eq(danceList.getId()))
            .execute();
        return danceList;
    }

    public void delete(UUID danceListId) {
        dsl.deleteFrom(DANCE_LISTS).where(DANCE_LISTS.ID.eq(danceListId)).execute();
    }

    private DanceList toDanceList(Record r) {
        return DanceList.builder()
            .id(r.get(DANCE_LISTS.ID))
            .userId(r.get(DANCE_LISTS.USER_ID))
            .groupId(r.get(DANCE_LISTS.GROUP_ID))
            .name(r.get(DANCE_LISTS.NAME))
            .description(r.get(DANCE_LISTS.DESCRIPTION))
            .isPublic(Boolean.TRUE.equals(r.get(DANCE_LISTS.IS_PUBLIC)))
            .shareToken(r.get(DANCE_LISTS.SHARE_TOKEN))
            .createdAt(r.get(DANCE_LISTS.CREATED_AT))
            .updatedAt(r.get(DANCE_LISTS.UPDATED_AT))
            .build();
    }
}
