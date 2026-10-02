package se.dansbart.domain.track;

import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

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
}
