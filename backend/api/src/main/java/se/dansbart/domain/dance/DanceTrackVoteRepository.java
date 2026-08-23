package se.dansbart.domain.dance;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * jOOQ repository for dance_track_votes.
 * Uses dynamic DSL since jOOQ codegen requires a live DB — run
 * ./mvnw generate-sources -Pgenerate-jooq after applying V19 to get typed classes
 * (voter_id is UUID and a weight column exists as of that migration).
 */
@Repository
public class DanceTrackVoteRepository {

    private static final Table<?> T = DSL.table("dance_track_votes");
    private static final Field<UUID> COL_DANCE_ID = DSL.field(DSL.name("dance_id"), UUID.class);
    private static final Field<UUID> COL_TRACK_ID = DSL.field(DSL.name("track_id"), UUID.class);
    private static final Field<UUID> COL_VOTER_ID = DSL.field(DSL.name("voter_id"), UUID.class);
    private static final Field<Integer> COL_VOTE = DSL.field(DSL.name("vote"), Integer.class);
    private static final Field<BigDecimal> COL_WEIGHT = DSL.field(DSL.name("weight"), BigDecimal.class);

    private final DSLContext dsl;

    public DanceTrackVoteRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    @Transactional
    public void upsertVote(UUID danceId, UUID trackId, UUID voterId, int vote, BigDecimal weight) {
        dsl.insertInto(T)
                .columns(
                        DSL.field(DSL.name("id"), UUID.class),
                        COL_DANCE_ID, COL_TRACK_ID, COL_VOTER_ID, COL_VOTE, COL_WEIGHT)
                .values(UUID.randomUUID(), danceId, trackId, voterId, vote, weight)
                .onConflict(COL_DANCE_ID, COL_TRACK_ID, COL_VOTER_ID)
                .doUpdate()
                .set(COL_VOTE, vote)
                .set(COL_WEIGHT, weight)
                .execute();
    }

    @Transactional
    public void deleteVote(UUID danceId, UUID trackId, UUID voterId) {
        dsl.deleteFrom(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_TRACK_ID.eq(trackId))
                .and(COL_VOTER_ID.eq(voterId))
                .execute();
    }

    /** Track IDs with weighted upvote sum >= VoterReputationService.MATCHING_THRESHOLD for this dance. */
    public List<UUID> findMatchingTrackIds(UUID danceId) {
        return dsl.select(COL_TRACK_ID)
                .from(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(1))
                .groupBy(COL_TRACK_ID)
                .having(DSL.sum(COL_WEIGHT).ge(new BigDecimal("1.0")))
                .fetch(COL_TRACK_ID);
    }

    /** Track IDs with weighted downvote sum >= VoterReputationService.SUPPRESSION_THRESHOLD
     *  and no upvotes for this dance. These are suppressed from the recommendation pool. */
    public List<UUID> findSuppressedTrackIds(UUID danceId) {
        var upvotedIds = dsl.selectDistinct(COL_TRACK_ID)
                .from(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(1));

        return dsl.select(COL_TRACK_ID)
                .from(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_VOTE.eq(-1))
                .and(COL_TRACK_ID.notIn(upvotedIds))
                .groupBy(COL_TRACK_ID)
                .having(DSL.sum(COL_WEIGHT).ge(new BigDecimal("2.0")))
                .fetch(COL_TRACK_ID);
    }

    public BigDecimal weightedUpvoteSumByDanceAndTrack(UUID danceId, UUID trackId) {
        var result = dsl.select(DSL.sum(COL_WEIGHT))
                .from(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_TRACK_ID.eq(trackId))
                .and(COL_VOTE.eq(1))
                .fetchOne();
        return (result != null && result.value1() != null) ? result.value1() : BigDecimal.ZERO;
    }

    public List<UUID> findUpvoterIdsByDanceAndTrack(UUID danceId, UUID trackId) {
        return dsl.select(COL_VOTER_ID)
                .from(T)
                .where(COL_DANCE_ID.eq(danceId))
                .and(COL_TRACK_ID.eq(trackId))
                .and(COL_VOTE.eq(1))
                .fetch(COL_VOTER_ID);
    }
}
