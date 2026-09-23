package se.dansbart.domain.dancelist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.DANCE_LIST_COLLABORATORS;
import static se.dansbart.jooq.Tables.USERS;

@Repository
public class DanceListCollaboratorJooqRepository {

    private final DSLContext dsl;

    public DanceListCollaboratorJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<DanceListCollaborator> findById(UUID id) {
        return dsl.selectFrom(DANCE_LIST_COLLABORATORS)
            .where(DANCE_LIST_COLLABORATORS.ID.eq(id))
            .fetchOptional(this::toCollaborator);
    }

    public Optional<DanceListCollaborator> findByDanceListIdAndUserId(UUID danceListId, UUID userId) {
        return dsl.selectFrom(DANCE_LIST_COLLABORATORS)
            .where(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID.eq(danceListId)
                .and(DANCE_LIST_COLLABORATORS.USER_ID.eq(userId)))
            .fetchOptional(this::toCollaborator);
    }

    public boolean existsByDanceListIdAndUserIdAndPermission(UUID danceListId, UUID userId, String permission) {
        return dsl.fetchExists(
            dsl.selectOne().from(DANCE_LIST_COLLABORATORS)
                .where(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID.eq(danceListId))
                .and(DANCE_LIST_COLLABORATORS.USER_ID.eq(userId))
                .and(DANCE_LIST_COLLABORATORS.PERMISSION.eq(permission))
                .and(DANCE_LIST_COLLABORATORS.STATUS.eq("accepted"))
        );
    }

    public List<DanceListCollaborator> findByDanceListId(UUID danceListId) {
        return dsl.select()
            .from(DANCE_LIST_COLLABORATORS)
            .leftJoin(USERS).on(USERS.ID.eq(DANCE_LIST_COLLABORATORS.USER_ID))
            .where(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID.eq(danceListId))
            .fetch(this::toCollaboratorWithUser);
    }

    public List<DanceListCollaborator> findByUserIdAndStatus(UUID userId, String status) {
        return dsl.selectFrom(DANCE_LIST_COLLABORATORS)
            .where(DANCE_LIST_COLLABORATORS.USER_ID.eq(userId)
                .and(DANCE_LIST_COLLABORATORS.STATUS.eq(status)))
            .fetch(this::toCollaborator);
    }

    public DanceListCollaborator save(DanceListCollaborator collab) {
        if (collab.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(DANCE_LIST_COLLABORATORS)
                .columns(
                    DANCE_LIST_COLLABORATORS.ID,
                    DANCE_LIST_COLLABORATORS.DANCE_LIST_ID,
                    DANCE_LIST_COLLABORATORS.USER_ID,
                    DANCE_LIST_COLLABORATORS.PERMISSION,
                    DANCE_LIST_COLLABORATORS.STATUS,
                    DANCE_LIST_COLLABORATORS.INVITED_BY,
                    DANCE_LIST_COLLABORATORS.ACCEPTED_AT
                )
                .values(
                    id,
                    collab.getDanceListId(),
                    collab.getUserId(),
                    collab.getPermission(),
                    collab.getStatus(),
                    collab.getInvitedBy(),
                    collab.getAcceptedAt()
                )
                .execute();
            collab.setId(id);
        } else {
            dsl.update(DANCE_LIST_COLLABORATORS)
                .set(DANCE_LIST_COLLABORATORS.PERMISSION, collab.getPermission())
                .set(DANCE_LIST_COLLABORATORS.STATUS, collab.getStatus())
                .set(DANCE_LIST_COLLABORATORS.INVITED_BY, collab.getInvitedBy())
                .set(DANCE_LIST_COLLABORATORS.ACCEPTED_AT, collab.getAcceptedAt())
                .where(DANCE_LIST_COLLABORATORS.ID.eq(collab.getId()))
                .execute();
        }
        return collab;
    }

    public void delete(DanceListCollaborator collab) {
        if (collab.getId() != null) {
            dsl.deleteFrom(DANCE_LIST_COLLABORATORS)
                .where(DANCE_LIST_COLLABORATORS.ID.eq(collab.getId()))
                .execute();
        }
    }

    private DanceListCollaborator toCollaborator(Record r) {
        DanceListCollaborator collab = new DanceListCollaborator();
        collab.setId(r.get(DANCE_LIST_COLLABORATORS.ID));
        collab.setDanceListId(r.get(DANCE_LIST_COLLABORATORS.DANCE_LIST_ID));
        collab.setUserId(r.get(DANCE_LIST_COLLABORATORS.USER_ID));
        collab.setPermission(r.get(DANCE_LIST_COLLABORATORS.PERMISSION));
        collab.setStatus(r.get(DANCE_LIST_COLLABORATORS.STATUS));
        collab.setInvitedBy(r.get(DANCE_LIST_COLLABORATORS.INVITED_BY));
        collab.setInvitedAt(r.get(DANCE_LIST_COLLABORATORS.INVITED_AT));
        collab.setAcceptedAt(r.get(DANCE_LIST_COLLABORATORS.ACCEPTED_AT));
        return collab;
    }

    private DanceListCollaborator toCollaboratorWithUser(Record r) {
        DanceListCollaborator collab = toCollaborator(r);
        String username = r.get(USERS.USERNAME);
        if (username != null) {
            se.dansbart.domain.user.User user = new se.dansbart.domain.user.User();
            user.setId(r.get(USERS.ID));
            user.setUsername(username);
            user.setDisplayName(r.get(USERS.DISPLAY_NAME));
            user.setAvatarUrl(r.get(USERS.AVATAR_URL));
            collab.setUser(user);
        }
        return collab;
    }
}
