package se.dansbart.domain.dancelist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_LIST_COLLABORATORS;
import static se.dansbart.jooq.Tables.DANCE_LISTS;

@Repository
public class DanceListJooqRepository {

    private final DSLContext dsl;

    public DanceListJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceList> findById(UUID id) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.ID.eq(id)).fetchOptional(this::toDanceList);
    }

    public List<DanceList> findByUserId(UUID userId) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.USER_ID.eq(userId)).orderBy(DANCE_LISTS.NAME.asc()).fetch(this::toDanceList);
    }

    public List<DanceList> findByGroupId(UUID groupId) {
        return dsl.selectFrom(DANCE_LISTS).where(DANCE_LISTS.GROUP_ID.eq(groupId)).orderBy(DANCE_LISTS.NAME.asc()).fetch(this::toDanceList);
    }

    public List<DanceList> findSharedWithUser(UUID userId) {
        return dsl.selectFrom(DANCE_LISTS)
            .where(DANCE_LISTS.ID.in(
                dsl.select(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID).from(DANCE_LIST_COLLABORATORS).where(DANCE_LIST_COLLABORATORS.USER_ID.eq(userId))
            ))
            .orderBy(DANCE_LISTS.NAME.asc())
            .fetch(this::toDanceList);
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
