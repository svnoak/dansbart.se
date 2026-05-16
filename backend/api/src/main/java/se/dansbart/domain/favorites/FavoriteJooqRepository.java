package se.dansbart.domain.favorites;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.table;

@Repository
public class FavoriteJooqRepository {

    private static final Table<?> FAVORITES = table("user_track_favorites");
    private static final Field<UUID> USER_ID = field("user_id", UUID.class);
    private static final Field<UUID> TRACK_ID = field("track_id", UUID.class);

    private final DSLContext dsl;

    public FavoriteJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public boolean isFavorited(UUID userId, UUID trackId) {
        return dsl.fetchExists(
            dsl.selectOne().from(FAVORITES)
                .where(USER_ID.eq(userId))
                .and(TRACK_ID.eq(trackId))
        );
    }

    public void add(UUID userId, UUID trackId) {
        dsl.insertInto(FAVORITES)
            .columns(USER_ID, TRACK_ID)
            .values(userId, trackId)
            .onConflictDoNothing()
            .execute();
    }

    public void remove(UUID userId, UUID trackId) {
        dsl.deleteFrom(FAVORITES)
            .where(USER_ID.eq(userId))
            .and(TRACK_ID.eq(trackId))
            .execute();
    }

    public List<UUID> findTrackIdsByUserId(UUID userId) {
        return dsl.select(TRACK_ID).from(FAVORITES)
            .where(USER_ID.eq(userId))
            .fetch(TRACK_ID);
    }
}
