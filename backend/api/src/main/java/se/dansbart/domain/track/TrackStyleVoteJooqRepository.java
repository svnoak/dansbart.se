package se.dansbart.domain.track;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.TRACK_STYLE_VOTES;

/**
 * jOOQ repository for track_style_votes.
 *
 * voter_id and weight use dynamic field overrides (COL_VOTER_ID, COL_WEIGHT) rather than
 * the generated TRACK_STYLE_VOTES.VOTER_ID binding, because V19 (voter reputation/vote
 * weighting) changed voter_id from VARCHAR to UUID and added a weight column without
 * access to a live database to run `./mvnw generate-sources -Pgenerate-jooq`. Once
 * that's been run against V19, this can drop the dynamic overrides in favor of the
 * regenerated, correctly-typed columns.
 */
@Repository
public class TrackStyleVoteJooqRepository {

    private static final Field<UUID> COL_VOTER_ID = DSL.field(DSL.name("voter_id"), UUID.class);
    private static final Field<BigDecimal> COL_WEIGHT = DSL.field(DSL.name("weight"), BigDecimal.class);

    private final DSLContext dsl;

    public TrackStyleVoteJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public List<TrackStyleVote> findByTrackId(UUID trackId) {
        return dsl.selectFrom(TRACK_STYLE_VOTES)
            .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId))
            .orderBy(TRACK_STYLE_VOTES.CREATED_AT.desc())
            .fetch(this::toVote);
    }

    public Optional<TrackStyleVote> findByTrackIdAndVoterId(UUID trackId, UUID voterId) {
        // Ordered + limited defensively: a UNIQUE(track_id, voter_id) constraint (V18) now
        // enforces at most one row per pair, but this keeps the read side safe even against
        // a stale replica or a pre-V18 row that somehow survived the dedup migration.
        return dsl.selectFrom(TRACK_STYLE_VOTES)
            .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId)
                .and(COL_VOTER_ID.eq(voterId)))
            .orderBy(TRACK_STYLE_VOTES.CREATED_AT.desc())
            .limit(1)
            .fetchOptional(this::toVote);
    }

    /** Distinct-voter count for a style, independent of vote weight. Kept for callers
     *  that care about raw participation rather than weighted trust (see
     *  weightedSumByTrackIdAndSuggestedStyle for the consensus/confirmation calculation). */
    public long countByTrackIdAndSuggestedStyle(UUID trackId, String suggestedStyle) {
        return dsl.fetchCount(
            dsl.selectDistinct(COL_VOTER_ID)
                .from(TRACK_STYLE_VOTES)
                .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId)
                    .and(TRACK_STYLE_VOTES.SUGGESTED_STYLE.eq(suggestedStyle)))
        );
    }

    /** Sum of vote weight for a track/style — the actual basis for confirmation and
     *  retraining thresholds (see VoterReputationService). */
    public BigDecimal weightedSumByTrackIdAndSuggestedStyle(UUID trackId, String suggestedStyle) {
        var result = dsl.select(DSL.sum(COL_WEIGHT))
            .from(TRACK_STYLE_VOTES)
            .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId)
                .and(TRACK_STYLE_VOTES.SUGGESTED_STYLE.eq(suggestedStyle)))
            .fetchOne();
        return (result != null && result.value1() != null) ? result.value1() : BigDecimal.ZERO;
    }

    public long count() {
        return dsl.fetchCount(TRACK_STYLE_VOTES);
    }

    public List<TrackStyleVote> findAll() {
        return dsl.selectFrom(TRACK_STYLE_VOTES)
            .orderBy(TRACK_STYLE_VOTES.CREATED_AT.desc())
            .fetch(this::toVote);
    }

    public TrackStyleVote save(TrackStyleVote vote) {
        if (vote.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(TRACK_STYLE_VOTES)
                .columns(
                    TRACK_STYLE_VOTES.ID,
                    TRACK_STYLE_VOTES.TRACK_ID,
                    COL_VOTER_ID,
                    TRACK_STYLE_VOTES.SUGGESTED_STYLE,
                    TRACK_STYLE_VOTES.TEMPO_CORRECTION,
                    COL_WEIGHT
                )
                .values(
                    id,
                    vote.getTrackId(),
                    vote.getVoterId(),
                    vote.getSuggestedStyle(),
                    vote.getTempoCorrection(),
                    vote.getWeight()
                )
                .execute();
            vote.setId(id);
        } else {
            dsl.update(TRACK_STYLE_VOTES)
                .set(TRACK_STYLE_VOTES.SUGGESTED_STYLE, vote.getSuggestedStyle())
                .set(TRACK_STYLE_VOTES.TEMPO_CORRECTION, vote.getTempoCorrection())
                .set(COL_WEIGHT, vote.getWeight())
                .where(TRACK_STYLE_VOTES.ID.eq(vote.getId()))
                .execute();
        }
        return vote;
    }

    private TrackStyleVote toVote(Record r) {
        BigDecimal weight = r.get(COL_WEIGHT);
        return TrackStyleVote.builder()
            .id(r.get(TRACK_STYLE_VOTES.ID))
            .trackId(r.get(TRACK_STYLE_VOTES.TRACK_ID))
            .voterId(r.get(COL_VOTER_ID))
            .suggestedStyle(r.get(TRACK_STYLE_VOTES.SUGGESTED_STYLE))
            .tempoCorrection(r.get(TRACK_STYLE_VOTES.TEMPO_CORRECTION))
            .weight(weight != null ? weight : BigDecimal.ONE)
            .createdAt(r.get(TRACK_STYLE_VOTES.CREATED_AT))
            .build();
    }
}
