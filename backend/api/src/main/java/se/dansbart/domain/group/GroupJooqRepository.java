package se.dansbart.domain.group;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.GROUP_MEMBERS;
import static se.dansbart.jooq.Tables.GROUPS;

@Repository
public class GroupJooqRepository {

    private final DSLContext dsl;

    public GroupJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<Group> findById(UUID id) {
        return dsl.selectFrom(GROUPS).where(GROUPS.ID.eq(id)).fetchOptional(this::toGroup);
    }

    public Optional<Group> findByNameIgnoreCase(String name) {
        return dsl.selectFrom(GROUPS)
            .where(GROUPS.NAME.lower().eq(name.trim().toLowerCase()))
            .fetchOptional(this::toGroup);
    }

    /** Locks the group's row so a concurrent request cannot remove the last admin at the same time. */
    public Optional<Group> lockForUpdate(UUID groupId) {
        return dsl.selectFrom(GROUPS).where(GROUPS.ID.eq(groupId)).forUpdate().fetchOptional(this::toGroup);
    }

    public List<Group> findPublicGroups() {
        return dsl.selectFrom(GROUPS)
            .where(GROUPS.IS_PUBLIC.isTrue())
            .orderBy(GROUPS.NAME.asc())
            .fetch(this::toGroup);
    }

    public List<Group> findByMemberUserId(UUID userId) {
        return dsl.select(GROUPS.fields())
            .from(GROUPS)
            .join(GROUP_MEMBERS).on(GROUP_MEMBERS.GROUP_ID.eq(GROUPS.ID))
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .and(GROUP_MEMBERS.STATUS.eq("accepted"))
            .orderBy(GROUPS.NAME.asc())
            .fetch(this::toGroup);
    }

    public Group insert(Group group) {
        UUID id = UUID.randomUUID();
        dsl.insertInto(GROUPS)
            .columns(GROUPS.ID, GROUPS.NAME, GROUPS.ABOUT_US, GROUPS.IS_PUBLIC)
            .values(id, group.getName(), group.getAboutUs(), group.getIsPublic())
            .execute();
        group.setId(id);
        return findById(id).orElseThrow();
    }

    public Group update(Group group) {
        dsl.update(GROUPS)
            .set(GROUPS.NAME, group.getName())
            .set(GROUPS.ABOUT_US, group.getAboutUs())
            .set(GROUPS.IS_PUBLIC, group.getIsPublic())
            .set(GROUPS.UPDATED_AT, java.time.OffsetDateTime.now())
            .where(GROUPS.ID.eq(group.getId()))
            .execute();
        return findById(group.getId()).orElseThrow();
    }

    public void delete(UUID groupId) {
        dsl.deleteFrom(GROUPS).where(GROUPS.ID.eq(groupId)).execute();
    }

    private Group toGroup(Record r) {
        return Group.builder()
            .id(r.get(GROUPS.ID))
            .name(r.get(GROUPS.NAME))
            .aboutUs(r.get(GROUPS.ABOUT_US))
            .isPublic(Boolean.TRUE.equals(r.get(GROUPS.IS_PUBLIC)))
            .createdAt(r.get(GROUPS.CREATED_AT))
            .updatedAt(r.get(GROUPS.UPDATED_AT))
            .build();
    }
}
