package se.dansbart.domain.track;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static se.dansbart.jooq.Tables.TRACKS;
import static se.dansbart.jooq.Tables.USER_TRACK_SOURCES;

@Repository
public class UserTrackSourceJooqRepository {

    private final DSLContext dsl;

    public UserTrackSourceJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /** The private tracks among the given ids for which the user holds no source. A null user holds none. */
    public Set<UUID> findPrivateTrackIdsWithoutHolder(List<UUID> trackIds, UUID userId) {
        Condition noSource = userId == null
            ? DSL.trueCondition()
            : DSL.notExists(dsl.selectOne().from(USER_TRACK_SOURCES)
                .where(USER_TRACK_SOURCES.TRACK_ID.eq(TRACKS.ID))
                .and(USER_TRACK_SOURCES.USER_ID.eq(userId)));
        return dsl.select(TRACKS.ID).from(TRACKS)
            .where(TRACKS.ID.in(trackIds))
            .and(TRACKS.IS_PRIVATE.isTrue())
            .and(noSource)
            .fetchSet(TRACKS.ID);
    }

    public UUID upsertSource(UUID userId, UUID trackId, String provider, String providerFileId,
                             String title, String artist, String album) {
        Record result = dsl.insertInto(USER_TRACK_SOURCES)
            .columns(USER_TRACK_SOURCES.USER_ID, USER_TRACK_SOURCES.TRACK_ID,
                USER_TRACK_SOURCES.PROVIDER, USER_TRACK_SOURCES.PROVIDER_FILE_ID, USER_TRACK_SOURCES.TITLE,
                USER_TRACK_SOURCES.ARTIST, USER_TRACK_SOURCES.ALBUM, USER_TRACK_SOURCES.ADDED_AT)
            .values(userId, trackId, provider, providerFileId,
                title, artist, album, OffsetDateTime.now())
            .onConflict(USER_TRACK_SOURCES.USER_ID, USER_TRACK_SOURCES.TRACK_ID, USER_TRACK_SOURCES.PROVIDER,
                USER_TRACK_SOURCES.PROVIDER_FILE_ID)
            .doUpdate()
            .set(USER_TRACK_SOURCES.TITLE, title)
            .set(USER_TRACK_SOURCES.ARTIST, artist)
            .set(USER_TRACK_SOURCES.ALBUM, album)
            .returning(USER_TRACK_SOURCES.ID)
            .fetchOne();
        return result != null ? result.get(USER_TRACK_SOURCES.ID) : null;
    }

    public List<UserTrackSource> findUserSourcesNewestFirst(UUID userId) {
        return dsl.select(USER_TRACK_SOURCES.ID, USER_TRACK_SOURCES.TRACK_ID,
                USER_TRACK_SOURCES.TITLE, USER_TRACK_SOURCES.ARTIST, USER_TRACK_SOURCES.ALBUM,
                USER_TRACK_SOURCES.PROVIDER, USER_TRACK_SOURCES.ADDED_AT, TRACKS.IS_PRIVATE)
            .from(USER_TRACK_SOURCES)
            .join(TRACKS).on(USER_TRACK_SOURCES.TRACK_ID.eq(TRACKS.ID))
            .where(USER_TRACK_SOURCES.USER_ID.eq(userId))
            .orderBy(USER_TRACK_SOURCES.ADDED_AT.desc())
            .fetch(r -> new UserTrackSource(
                r.get(USER_TRACK_SOURCES.ID),
                r.get(USER_TRACK_SOURCES.TRACK_ID),
                r.get(USER_TRACK_SOURCES.TITLE),
                r.get(USER_TRACK_SOURCES.ARTIST),
                r.get(USER_TRACK_SOURCES.ALBUM),
                r.get(USER_TRACK_SOURCES.PROVIDER),
                r.get(USER_TRACK_SOURCES.ADDED_AT),
                r.get(TRACKS.IS_PRIVATE)
            ));
    }

    public boolean deleteSourceIfOwner(UUID sourceId, UUID userId) {
        int rowsDeleted = dsl.deleteFrom(USER_TRACK_SOURCES)
            .where(USER_TRACK_SOURCES.ID.eq(sourceId))
            .and(USER_TRACK_SOURCES.USER_ID.eq(userId))
            .execute();
        return rowsDeleted > 0;
    }
}
