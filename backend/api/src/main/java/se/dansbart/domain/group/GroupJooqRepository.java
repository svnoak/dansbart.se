package se.dansbart.domain.group;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.count;
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

    public List<GroupWithMemberCount> findPublicGroups() {
        return dsl.select(GROUPS.fields())
            .select(memberCountField())
            .from(GROUPS)
            .where(GROUPS.IS_PUBLIC.isTrue())
            .orderBy(GROUPS.NAME.asc())
            .fetch(this::toGroupWithMemberCount);
    }

    public List<GroupWithMemberCount> findByMemberUserId(UUID userId) {
        return dsl.select(GROUPS.fields())
            .select(memberCountField())
            .from(GROUPS)
            .join(GROUP_MEMBERS).on(GROUP_MEMBERS.GROUP_ID.eq(GROUPS.ID))
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .and(GROUP_MEMBERS.STATUS.eq("accepted"))
            .orderBy(GROUPS.NAME.asc())
            .fetch(this::toGroupWithMemberCount);
    }

    private Field<Integer> memberCountField() {
        return field(
            dsl.select(count())
                .from(GROUP_MEMBERS)
                .where(GROUP_MEMBERS.GROUP_ID.eq(GROUPS.ID))
                .and(GROUP_MEMBERS.STATUS.eq("accepted"))
        ).as("member_count");
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

    private GroupWithMemberCount toGroupWithMemberCount(Record r) {
        return new GroupWithMemberCount(toGroup(r), r.get("member_count", Integer.class));
    }

    public record GroupWithMemberCount(Group group, int memberCount) {}
}
