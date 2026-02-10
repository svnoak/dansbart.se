package se.dansbart.domain.user;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.PLAYLIST_COLLABORATORS;

@Repository
public class PlaylistCollaboratorJooqRepository {

    private final DSLContext dsl;

    public PlaylistCollaboratorJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<PlaylistCollaborator> findById(UUID id) {
        return dsl.selectFrom(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.ID.eq(id))
            .fetchOptional(this::toCollaborator);
    }

    public Optional<PlaylistCollaborator> findByPlaylistIdAndUserId(UUID playlistId, String userId) {
        return dsl.selectFrom(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId)
                .and(PLAYLIST_COLLABORATORS.USER_ID.eq(userId)))
            .fetchOptional(this::toCollaborator);
    }

    public boolean existsByPlaylistIdAndUserIdAndPermission(UUID playlistId, String userId, String permission) {
        return dsl.fetchExists(
            dsl.selectOne()
                .from(PLAYLIST_COLLABORATORS)
                .where(PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId))
                .and(PLAYLIST_COLLABORATORS.USER_ID.eq(userId))
                .and(PLAYLIST_COLLABORATORS.PERMISSION.eq(permission))
        );
    }

    public List<PlaylistCollaborator> findByPlaylistId(UUID playlistId) {
        return dsl.selectFrom(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId))
            .fetch(this::toCollaborator);
    }

    public List<PlaylistCollaborator> findByUserIdAndStatus(String userId, String status) {
        return dsl.selectFrom(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.USER_ID.eq(userId)
                .and(PLAYLIST_COLLABORATORS.STATUS.eq(status)))
            .fetch(this::toCollaborator);
    }

    public PlaylistCollaborator save(PlaylistCollaborator collab) {
        if (collab.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(PLAYLIST_COLLABORATORS)
                .columns(
                    PLAYLIST_COLLABORATORS.ID,
                    PLAYLIST_COLLABORATORS.PLAYLIST_ID,
                    PLAYLIST_COLLABORATORS.USER_ID,
                    PLAYLIST_COLLABORATORS.PERMISSION,
                    PLAYLIST_COLLABORATORS.STATUS,
                    PLAYLIST_COLLABORATORS.INVITED_BY,
                    PLAYLIST_COLLABORATORS.ACCEPTED_AT
                )
                .values(
                    id,
                    collab.getPlaylistId(),
                    collab.getUserId(),
                    collab.getPermission(),
                    collab.getStatus(),
                    collab.getInvitedBy(),
                    collab.getAcceptedAt()
                )
                .execute();
            collab.setId(id);
        } else {
            dsl.update(PLAYLIST_COLLABORATORS)
                .set(PLAYLIST_COLLABORATORS.PERMISSION, collab.getPermission())
                .set(PLAYLIST_COLLABORATORS.STATUS, collab.getStatus())
                .set(PLAYLIST_COLLABORATORS.INVITED_BY, collab.getInvitedBy())
                .set(PLAYLIST_COLLABORATORS.ACCEPTED_AT, collab.getAcceptedAt())
                .where(PLAYLIST_COLLABORATORS.ID.eq(collab.getId()))
                .execute();
        }
        return collab;
    }

    public void delete(PlaylistCollaborator collab) {
        if (collab.getId() != null) {
            dsl.deleteFrom(PLAYLIST_COLLABORATORS)
                .where(PLAYLIST_COLLABORATORS.ID.eq(collab.getId()))
                .execute();
        }
    }

    public void deleteByPlaylistIdAndId(UUID playlistId, UUID collaboratorId) {
        dsl.deleteFrom(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId)
                .and(PLAYLIST_COLLABORATORS.ID.eq(collaboratorId)))
            .execute();
    }

    private PlaylistCollaborator toCollaborator(Record r) {
        PlaylistCollaborator collab = new PlaylistCollaborator();
        collab.setId(r.get(PLAYLIST_COLLABORATORS.ID));
        collab.setPlaylistId(r.get(PLAYLIST_COLLABORATORS.PLAYLIST_ID));
        collab.setUserId(r.get(PLAYLIST_COLLABORATORS.USER_ID));
        collab.setPermission(r.get(PLAYLIST_COLLABORATORS.PERMISSION));
        collab.setStatus(r.get(PLAYLIST_COLLABORATORS.STATUS));
        collab.setInvitedBy(r.get(PLAYLIST_COLLABORATORS.INVITED_BY));
        collab.setInvitedAt(r.get(PLAYLIST_COLLABORATORS.INVITED_AT));
        collab.setAcceptedAt(r.get(PLAYLIST_COLLABORATORS.ACCEPTED_AT));
        return collab;
    }
}

