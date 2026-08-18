package se.dansbart.domain.track;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Dedup store for secondary-style confirmations: one confirmation per voter per style
 * (track_secondary_style_confirmations, added in V18).
 *
 * Uses plain SQL rather than a generated jOOQ table binding because this table was added
 * without access to a live database to run {@code ./mvnw generate-sources -Pgenerate-jooq}.
 * Once that's been run against V18, this can be rewritten against the generated
 * TRACK_SECONDARY_STYLE_CONFIRMATIONS table for full type safety.
 */
@Repository
public class TrackSecondaryStyleConfirmationRepository {

    private final DSLContext dsl;

    public TrackSecondaryStyleConfirmationRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    /**
     * Records a voter's confirmation of a secondary style.
     *
     * @return true if this was a new confirmation (row inserted), false if this voter had
     *         already confirmed this style (no-op via ON CONFLICT DO NOTHING).
     */
    public boolean recordConfirmation(UUID trackId, UUID danceStyleId, String voterId) {
        int inserted = dsl.execute(
            "INSERT INTO track_secondary_style_confirmations (track_id, dance_style_id, voter_id) "
                + "VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            trackId, danceStyleId, voterId
        );
        return inserted > 0;
    }
}
