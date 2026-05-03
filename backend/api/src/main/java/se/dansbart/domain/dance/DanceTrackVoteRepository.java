package se.dansbart.domain.dance;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * jOOQ repository for dance_track_votes.
 * Uses dynamic DSL since jOOQ codegen runs against a live DB — run
 * ./mvnw generate-sources -Pgenerate-jooq after applying V15 migration to get typed classes.
 */
@Repository
public class DanceTrackVoteRepository {

    private static final Table<?> DANCE_TRACK_VOTES = DSL.table("dance_track_votes");
    private static final Field<UUID> COL_DANCE_ID = DSL.field(DSL.name("dance_id"), UUID.class);
    private static final Field<UUID> COL_TRACK_ID = DSL.field(DSL.name("track_id"), UUID.class);
    private static final Field<String> COL_VOTER_ID = DSL.field(DSL.name("voter_id"), String.class);
    private static final Field<Integer> COL_VOTE = DSL.field(DSL.name("vote"), Integer.class);

    private final DSLContext dsl;

    public DanceTrackVoteRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Transactional
    public void upsertVote(UUID danceId, UUID trackId, String voterId, int vote) {
        dsl.insertInto(DANCE_TRACK_VOTES)
                .columns(
                        DSL.field(DSL.name("id"), UUID.class),
                        COL_DANCE_ID, COL_TRACK_ID, COL_VOTER_ID, COL_VOTE)
                .values(UUID.randomUUID(), danceId, trackId, voterId, vote)
                .onConflict(COL_DANCE_ID, COL_TRACK_ID, COL_VOTER_ID)
                .doUpdate()
                .set(COL_VOTE, vote)
                .execute();
    }

    @Transactional
    public void deleteVote(UUID danceId, UUID trackId, String voterId) {
        dsl.deleteFrom(DANCE_TRACK_VOTES)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_TRACK_ID.eq(trackId))
                .and(COL_VOTER_ID.eq(voterId))
                .execute();
    }

    /** Track IDs for this dance that have at least one upvote. */
    public List<UUID> findMatchingTrackIds(UUID danceId) {
        return dsl.selectDistinct(COL_TRACK_ID)
                .from(DANCE_TRACK_VOTES)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(1))
                .fetch(COL_TRACK_ID);
    }

    /**
     * Track IDs that have ≥2 downvotes (net score ≤ -2) and no upvotes for this dance.
     * These are suppressed from the recommendation pool.
     */
    public List<UUID> findSuppressedTrackIds(UUID danceId) {
        var upvotedIds = dsl.selectDistinct(COL_TRACK_ID)
                .from(DANCE_TRACK_VOTES)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(1));

        return dsl.select(COL_TRACK_ID)
                .from(DANCE_TRACK_VOTES)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(-1))
                .and(COL_TRACK_ID.notIn(upvotedIds))
                .groupBy(COL_TRACK_ID)
                .having(DSL.count().ge(2))
                .fetch(COL_TRACK_ID);
    }
}