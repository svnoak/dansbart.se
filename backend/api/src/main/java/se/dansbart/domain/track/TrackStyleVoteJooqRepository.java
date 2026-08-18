package se.dansbart.domain.track;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static se.dansbart.jooq.Tables.TRACK_STYLE_VOTES;

@Repository
public class TrackStyleVoteJooqRepository {

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

    public Optional<TrackStyleVote> findByTrackIdAndVoterId(UUID trackId, String voterId) {
        // Ordered + limited defensively: a UNIQUE(track_id, voter_id) constraint (V18) now
        // enforces at most one row per pair, but this keeps the read side safe even against
        // a stale replica or a pre-V18 row that somehow survived the dedup migration.
        return dsl.selectFrom(TRACK_STYLE_VOTES)
            .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId)
                .and(TRACK_STYLE_VOTES.VOTER_ID.eq(voterId)))
            .orderBy(TRACK_STYLE_VOTES.CREATED_AT.desc())
            .limit(1)
            .fetchOptional(this::toVote);
    }

    public long countByTrackIdAndSuggestedStyle(UUID trackId, String suggestedStyle) {
        // COUNT(DISTINCT voter_id), not a row count: the confirmation threshold is meant to
        // require N distinct people agreeing, not N rows (which a bug previously conflated).
        return dsl.fetchCount(
            dsl.selectDistinct(TRACK_STYLE_VOTES.VOTER_ID)
                .from(TRACK_STYLE_VOTES)
                .where(TRACK_STYLE_VOTES.TRACK_ID.eq(trackId)
                    .and(TRACK_STYLE_VOTES.SUGGESTED_STYLE.eq(suggestedStyle)))
        );
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
                    TRACK_STYLE_VOTES.VOTER_ID,
                    TRACK_STYLE_VOTES.SUGGESTED_STYLE,
                    TRACK_STYLE_VOTES.TEMPO_CORRECTION
                )
                .values(
                    id,
                    vote.getTrackId(),
                    vote.getVoterId(),
                    vote.getSuggestedStyle(),
                    vote.getTempoCorrection()
                )
                .execute();
            vote.setId(id);
        } else {
            dsl.update(TRACK_STYLE_VOTES)
                .set(TRACK_STYLE_VOTES.SUGGESTED_STYLE, vote.getSuggestedStyle())
                .set(TRACK_STYLE_VOTES.TEMPO_CORRECTION, vote.getTempoCorrection())
                .where(TRACK_STYLE_VOTES.ID.eq(vote.getId()))
                .execute();
        }
        return vote;
    }

    private TrackStyleVote toVote(Record r) {
        return TrackStyleVote.builder()
            .id(r.get(TRACK_STYLE_VOTES.ID))
            .trackId(r.get(TRACK_STYLE_VOTES.TRACK_ID))
            .voterId(r.get(TRACK_STYLE_VOTES.VOTER_ID))
            .suggestedStyle(r.get(TRACK_STYLE_VOTES.SUGGESTED_STYLE))
            .tempoCorrection(r.get(TRACK_STYLE_VOTES.TEMPO_CORRECTION))
            .createdAt(r.get(TRACK_STYLE_VOTES.CREATED_AT))
            .build();
    }
}

