package se.dansbart.domain.playlist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
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

    public Optional<Playlist> findByShareToken(String shareToken) {
        return dsl.selectFrom(PLAYLISTS).where(PLAYLISTS.SHARE_TOKEN.eq(shareToken)).fetchOptional().map(this::toPlaylist);
    }

    public List<Playlist> findSharedWithUser(UUID userId) {
        return dsl.selectFrom(PLAYLISTS)
            .where(PLAYLISTS.ID.in(
                dsl.select(PLAYLIST_COLLABORATORS.PLAYLIST_ID).from(PLAYLIST_COLLABORATORS).where(PLAYLIST_COLLABORATORS.USER_ID.eq(userId))
            ))
            .orderBy(PLAYLISTS.NAME.asc())
            .fetch(this::toPlaylist);
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
        );
    }

    public Playlist insert(Playlist playlist) {
        UUID id = playlist.getId() != null ? playlist.getId() : UUID.randomUUID();
        dsl.insertInto(PLAYLISTS)
            .columns(PLAYLISTS.ID, PLAYLISTS.USER_ID, PLAYLISTS.NAME, PLAYLISTS.DESCRIPTION, PLAYLISTS.IS_PUBLIC, PLAYLISTS.SHARE_TOKEN, PLAYLISTS.DANCE_STYLE, PLAYLISTS.SUB_STYLE, PLAYLISTS.TEMPO_CATEGORY)
            .values(id, playlist.getUserId(), playlist.getName(), playlist.getDescription(), playlist.getIsPublic(), playlist.getShareToken(), playlist.getDanceStyle(), playlist.getSubStyle(), playlist.getTempoCategory())
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
            .isPublic(r.get(PLAYLISTS.IS_PUBLIC) != null && r.get(PLAYLISTS.IS_PUBLIC))
            .shareToken(r.get(PLAYLISTS.SHARE_TOKEN))
            .danceStyle(r.get(PLAYLISTS.DANCE_STYLE))
            .subStyle(r.get(PLAYLISTS.SUB_STYLE))
            .tempoCategory(r.get(PLAYLISTS.TEMPO_CATEGORY))
            .createdAt(createdAt)
            .updatedAt(updatedAt)
            .build();
    }
}
