package se.dansbart.domain.dance;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.table;

@Repository
public class DancePrimaryTrackJooqRepository {

    private static final Table<?> PRIMARY_TRACKS = table("user_dance_primary_tracks");
    private static final Field<UUID> USER_ID  = field("user_id",  UUID.class);
    private static final Field<UUID> DANCE_ID = field("dance_id", UUID.class);
    private static final Field<UUID> TRACK_ID = field("track_id", UUID.class);

    private final DSLContext dsl;

    public DancePrimaryTrackJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void set(UUID userId, UUID danceId, UUID trackId) {
        dsl.insertInto(PRIMARY_TRACKS)
            .columns(USER_ID, DANCE_ID, TRACK_ID)
            .values(userId, danceId, trackId)
            .onConflict(USER_ID, DANCE_ID)
            .doUpdate()
            .set(TRACK_ID, trackId)
            .execute();
    }

    public void clear(UUID userId, UUID danceId) {
        dsl.deleteFrom(PRIMARY_TRACKS)
            .where(USER_ID.eq(userId))
            .and(DANCE_ID.eq(danceId))
            .execute();
    }

    public Optional<UUID> findTrackId(UUID userId, UUID danceId) {
        return dsl.select(TRACK_ID)
            .from(PRIMARY_TRACKS)
            .where(USER_ID.eq(userId))
            .and(DANCE_ID.eq(danceId))
            .fetchOptional(TRACK_ID);
    }
}
