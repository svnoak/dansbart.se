package se.dansbart.domain.playlist;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Record1;
import org.jooq.SelectConditionStep;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.field;
import static se.dansbart.jooq.Tables.GROUP_MEMBERS;
import static se.dansbart.jooq.Tables.GROUPS;
import static se.dansbart.jooq.Tables.PLAYLIST_COLLABORATORS;
import static se.dansbart.jooq.Tables.PLAYLIST_TRACKS;
import static se.dansbart.jooq.Tables.PLAYLISTS;

@Repository
public class PlaylistJooqRepository {

    private final DSLContext dsl;

    public PlaylistJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<Playlist> findById(UUID id) {
        return dsl.selectFrom(PLAYLISTS).where(PLAYLISTS.ID.eq(id)).fetchOptional().map(this::toPlaylist);
    }

    public List<Playlist> findByUserId(UUID userId) {
        return dsl.selectFrom(PLAYLISTS).where(PLAYLISTS.USER_ID.eq(userId)).orderBy(PLAYLISTS.NAME.asc()).fetch(this::toPlaylist);
    }

    public List<PlaylistWithGroupName> findOwnedAndGroupPlaylistsByUserId(UUID userId) {
        var acceptedGroups = acceptedGroupsSubquery(userId);
        return dsl.select(PLAYLISTS.fields())
            .select(trackCountField(), GROUPS.NAME.as("group_name"))
            .from(PLAYLISTS)
            .leftJoin(GROUPS).on(PLAYLISTS.GROUP_ID.eq(GROUPS.ID))
            .where(PLAYLISTS.USER_ID.eq(userId))
            .or(PLAYLISTS.GROUP_ID.in(acceptedGroups))
            .or(PLAYLISTS.ID.in(groupCollaboratorPlaylistsSubquery(userId, null)))
            .orderBy(PLAYLISTS.NAME.asc())
            .fetch(r -> new PlaylistWithGroupName(toPlaylist(r), r.get("track_count", Integer.class), r.get("group_name", String.class)));
    }

    public List<PlaylistWithTrackCount> findByGroupIdWithTrackCount(UUID groupId, boolean includePrivate) {
        var condition = includePrivate
            ? PLAYLISTS.GROUP_ID.eq(groupId)
            : PLAYLISTS.GROUP_ID.eq(groupId).and(PLAYLISTS.IS_PUBLIC.isTrue());
        return dsl.select(PLAYLISTS.fields())
            .select(trackCountField())
            .from(PLAYLISTS)
            .where(condition)
            .orderBy(PLAYLISTS.NAME.asc())
            .fetch(this::toPlaylistWithTrackCount);
    }

    private Field<Integer> trackCountField() {
        return field(
            dsl.select(count())
                .from(PLAYLIST_TRACKS)
                .where(PLAYLIST_TRACKS.PLAYLIST_ID.eq(PLAYLISTS.ID))
        ).as("track_count");
    }

    public Optional<Playlist> findByShareToken(String shareToken) {
        return dsl.selectFrom(PLAYLISTS).where(PLAYLISTS.SHARE_TOKEN.eq(shareToken)).fetchOptional().map(this::toPlaylist);
    }

    public List<Playlist> findSharedWithUser(UUID userId) {
        return dsl.selectFrom(PLAYLISTS)
            .where(PLAYLISTS.ID.in(
                dsl.select(PLAYLIST_COLLABORATORS.PLAYLIST_ID).from(PLAYLIST_COLLABORATORS).where(PLAYLIST_COLLABORATORS.USER_ID.eq(userId))
            ))
            .or(PLAYLISTS.ID.in(groupCollaboratorPlaylistsSubquery(userId, null)))
            .orderBy(PLAYLISTS.NAME.asc())
            .fetch(this::toPlaylist);
    }

    public List<EditablePlaylistRecord> findEditableByUserId(UUID userId) {
        var editCollaborations = dsl.select(PLAYLIST_COLLABORATORS.PLAYLIST_ID)
            .from(PLAYLIST_COLLABORATORS)
            .where(PLAYLIST_COLLABORATORS.USER_ID.eq(userId))
            .and(PLAYLIST_COLLABORATORS.PERMISSION.eq("edit"))
            .and(PLAYLIST_COLLABORATORS.STATUS.eq("accepted"));
        var managedGroups = dsl.select(GROUP_MEMBERS.GROUP_ID)
            .from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .and(GROUP_MEMBERS.STATUS.eq("accepted"))
            .and(GROUP_MEMBERS.IS_ADMIN.isTrue().or(GROUP_MEMBERS.CAN_MANAGE_PLAYLISTS.isTrue()));
        return dsl.select(PLAYLISTS.ID, PLAYLISTS.NAME, GROUPS.NAME.as("group_name"))
            .from(PLAYLISTS)
            .leftJoin(GROUPS).on(PLAYLISTS.GROUP_ID.eq(GROUPS.ID))
            .where(PLAYLISTS.USER_ID.eq(userId))
            .or(PLAYLISTS.ID.in(editCollaborations))
            .or(PLAYLISTS.GROUP_ID.in(managedGroups))
            .or(PLAYLISTS.ID.in(groupCollaboratorPlaylistsSubquery(userId, "edit")))
            .orderBy(PLAYLISTS.NAME.asc())
            .fetch(r -> new EditablePlaylistRecord(r.get(PLAYLISTS.ID), r.get(PLAYLISTS.NAME), r.get("group_name", String.class)));
    }

    private SelectConditionStep<Record1<UUID>> acceptedGroupsSubquery(UUID userId) {
        return dsl.select(GROUP_MEMBERS.GROUP_ID)
            .from(GROUP_MEMBERS)
            .where(GROUP_MEMBERS.USER_ID.eq(userId))
            .and(GROUP_MEMBERS.STATUS.eq("accepted"));
    }

    private SelectConditionStep<Record1<UUID>> groupCollaboratorPlaylistsSubquery(UUID userId, String permission) {
        Condition condition = PLAYLIST_COLLABORATORS.GROUP_ID.in(acceptedGroupsSubquery(userId))
            .and(PLAYLIST_COLLABORATORS.STATUS.eq("accepted"));
        if (permission != null) {
            condition = condition.and(PLAYLIST_COLLABORATORS.PERMISSION.eq(permission));
        }
        return dsl.select(PLAYLIST_COLLABORATORS.PLAYLIST_ID)
            .from(PLAYLIST_COLLABORATORS)
            .where(condition);
    }

    public long countAll() {
        return dsl.fetchCount(PLAYLISTS);
    }

    public int getTrackCount(UUID playlistId) {
        return dsl.fetchCount(dsl.selectFrom(PLAYLIST_TRACKS).where(PLAYLIST_TRACKS.PLAYLIST_ID.eq(playlistId)));
    }

    public boolean existsByPlaylistIdAndUserIdAndPermission(UUID playlistId, UUID userId, String permission) {
        return dsl.fetchExists(
            dsl.selectOne().from(PLAYLIST_COLLABORATORS)
                .where(PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId))
                .and(PLAYLIST_COLLABORATORS.USER_ID.eq(userId))
                .and(PLAYLIST_COLLABORATORS.PERMISSION.eq(permission))
                .and(PLAYLIST_COLLABORATORS.STATUS.eq("accepted"))
        );
    }

    public boolean hasAcceptedGroupCollaboration(UUID playlistId, UUID userId) {
        return hasAcceptedGroupCollaboration(playlistId, userId, null);
    }

    public boolean hasAcceptedGroupCollaborationWithPermission(UUID playlistId, UUID userId, String permission) {
        return hasAcceptedGroupCollaboration(playlistId, userId, permission);
    }

    private boolean hasAcceptedGroupCollaboration(UUID playlistId, UUID userId, String permission) {
        Condition condition = PLAYLIST_COLLABORATORS.PLAYLIST_ID.eq(playlistId)
            .and(PLAYLIST_COLLABORATORS.GROUP_ID.isNotNull())
            .and(PLAYLIST_COLLABORATORS.STATUS.eq("accepted"));
        if (permission != null) {
            condition = condition.and(PLAYLIST_COLLABORATORS.PERMISSION.eq(permission));
        }
        return dsl.fetchExists(
            dsl.selectOne().from(PLAYLIST_COLLABORATORS)
                .where(condition)
                .and(DSL.exists(dsl.selectOne().from(GROUP_MEMBERS)
                    .where(GROUP_MEMBERS.GROUP_ID.eq(PLAYLIST_COLLABORATORS.GROUP_ID))
                    .and(GROUP_MEMBERS.USER_ID.eq(userId))
                    .and(GROUP_MEMBERS.STATUS.eq("accepted"))))
        );
    }

    public Playlist insert(Playlist playlist) {
        UUID id = playlist.getId() != null ? playlist.getId() : UUID.randomUUID();
        dsl.insertInto(PLAYLISTS)
            .columns(PLAYLISTS.ID, PLAYLISTS.USER_ID, PLAYLISTS.GROUP_ID, PLAYLISTS.NAME, PLAYLISTS.DESCRIPTION, PLAYLISTS.IS_PUBLIC, PLAYLISTS.SHARE_TOKEN, PLAYLISTS.DANCE_STYLE, PLAYLISTS.SUB_STYLE, PLAYLISTS.TEMPO_CATEGORY)
            .values(id, playlist.getUserId(), playlist.getGroupId(), playlist.getName(), playlist.getDescription(), playlist.getIsPublic(), playlist.getShareToken(), playlist.getDanceStyle(), playlist.getSubStyle(), playlist.getTempoCategory())
            .execute();
        playlist.setId(id);
        return playlist;
    }

    public Playlist update(Playlist playlist) {
        OffsetDateTime updatedAt = playlist.getUpdatedAt();
        LocalDateTime updatedAtRaw = updatedAt != null ? updatedAt.toLocalDateTime() : null;
        dsl.update(PLAYLISTS)
            .set(PLAYLISTS.NAME, playlist.getName())
            .set(PLAYLISTS.DESCRIPTION, playlist.getDescription())
            .set(PLAYLISTS.IS_PUBLIC, playlist.getIsPublic())
            .set(PLAYLISTS.SHARE_TOKEN, playlist.getShareToken())
            .set(PLAYLISTS.DANCE_STYLE, playlist.getDanceStyle())
            .set(PLAYLISTS.SUB_STYLE, playlist.getSubStyle())
            .set(PLAYLISTS.TEMPO_CATEGORY, playlist.getTempoCategory())
            .set(PLAYLISTS.UPDATED_AT, updatedAtRaw)
            .where(PLAYLISTS.ID.eq(playlist.getId()))
            .execute();
        return playlist;
    }

    public void delete(UUID playlistId) {
        dsl.deleteFrom(PLAYLISTS).where(PLAYLISTS.ID.eq(playlistId)).execute();
    }

    private Playlist toPlaylist(Record r) {
        LocalDateTime createdAtRaw = r.get(PLAYLISTS.CREATED_AT);
        LocalDateTime updatedAtRaw = r.get(PLAYLISTS.UPDATED_AT);

        OffsetDateTime createdAt = createdAtRaw != null ? createdAtRaw.atOffset(ZoneOffset.UTC) : null;
        OffsetDateTime updatedAt = updatedAtRaw != null ? updatedAtRaw.atOffset(ZoneOffset.UTC) : null;

        return Playlist.builder()
            .id(r.get(PLAYLISTS.ID))
            .name(r.get(PLAYLISTS.NAME))
            .description(r.get(PLAYLISTS.DESCRIPTION))
            .userId(r.get(PLAYLISTS.USER_ID))
            .groupId(r.get(PLAYLISTS.GROUP_ID))
            .isPublic(r.get(PLAYLISTS.IS_PUBLIC) != null && r.get(PLAYLISTS.IS_PUBLIC))
            .shareToken(r.get(PLAYLISTS.SHARE_TOKEN))
            .danceStyle(r.get(PLAYLISTS.DANCE_STYLE))
            .subStyle(r.get(PLAYLISTS.SUB_STYLE))
            .tempoCategory(r.get(PLAYLISTS.TEMPO_CATEGORY))
            .createdAt(createdAt)
            .updatedAt(updatedAt)
            .build();
    }

    private PlaylistWithTrackCount toPlaylistWithTrackCount(Record r) {
        return new PlaylistWithTrackCount(toPlaylist(r), r.get("track_count", Integer.class));
    }

    public record PlaylistWithTrackCount(Playlist playlist, int trackCount) {}

    public record PlaylistWithGroupName(Playlist playlist, int trackCount, String groupName) {}

    public record EditablePlaylistRecord(UUID id, String name, String groupName) {}
}
