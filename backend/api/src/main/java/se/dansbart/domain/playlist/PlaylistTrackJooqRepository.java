package se.dansbart.domain.playlist;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static se.dansbart.jooq.Tables.PLAYLIST_TRACKS;

@Repository
public class PlaylistTrackJooqRepository {

    private final DSLContext dsl;

    public PlaylistTrackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public PlaylistTrack insert(PlaylistTrack track) {
        UUID id = track.getId() != null ? track.getId() : UUID.randomUUID();
        dsl.insertInto(PLAYLIST_TRACKS)
            .columns(PLAYLIST_TRACKS.ID, PLAYLIST_TRACKS.PLAYLIST_ID, PLAYLIST_TRACKS.TRACK_ID, PLAYLIST_TRACKS.POSITION)
            .values(id, track.getPlaylistId(), track.getTrackId(), track.getPosition())
            .execute();
        track.setId(id);
        return track;
    }

    public void deleteByPlaylistIdAndTrackId(UUID playlistId, UUID trackId) {
        dsl.deleteFrom(PLAYLIST_TRACKS)
            .where(PLAYLIST_TRACKS.PLAYLIST_ID.eq(playlistId).and(PLAYLIST_TRACKS.TRACK_ID.eq(trackId)))
            .execute();
    }

    public List<PlaylistTrack> findByPlaylistIdOrderByPositionAsc(UUID playlistId) {
        return dsl.selectFrom(PLAYLIST_TRACKS)
            .where(PLAYLIST_TRACKS.PLAYLIST_ID.eq(playlistId))
            .orderBy(PLAYLIST_TRACKS.POSITION.asc())
            .fetch(this::toPlaylistTrack);
    }

    public void saveAll(List<PlaylistTrack> tracks) {
        if (tracks == null || tracks.isEmpty()) return;
        dsl.batch(
            tracks.stream()
                .map(t -> dsl.update(PLAYLIST_TRACKS)
                    .set(PLAYLIST_TRACKS.POSITION, t.getPosition())
                    .where(PLAYLIST_TRACKS.ID.eq(t.getId())))
                .toList()
        ).execute();
    }

    private PlaylistTrack toPlaylistTrack(Record r) {
        PlaylistTrack pt = new PlaylistTrack();
        pt.setId(r.get(PLAYLIST_TRACKS.ID));
        pt.setPlaylistId(r.get(PLAYLIST_TRACKS.PLAYLIST_ID));
        pt.setTrackId(r.get(PLAYLIST_TRACKS.TRACK_ID));
        pt.setPosition(r.get(PLAYLIST_TRACKS.POSITION));

        LocalDateTime addedAtRaw = r.get(PLAYLIST_TRACKS.ADDED_AT);
        OffsetDateTime addedAt = addedAtRaw != null ? addedAtRaw.atOffset(ZoneOffset.UTC) : null;
        pt.setAddedAt(addedAt);

        return pt;
    }
}

