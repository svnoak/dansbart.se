package se.dansbart.domain.reputation;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * jOOQ repository for voter_reputation (added in V19). Uses dynamic DSL rather than a
 * generated table binding since this table was added without access to a live database
 * to run {@code ./mvnw generate-sources -Pgenerate-jooq}. Once that's been run, this can
 * be rewritten against the generated VOTER_REPUTATION table for full type safety.
 */
@Repository
public class VoterReputationJooqRepository {

    private static final Table<?> T = DSL.table("voter_reputation");
    private static final Field<UUID> COL_ID = DSL.field(DSL.name("voter_id"), UUID.class);
    private static final Field<BigDecimal> COL_MULT = DSL.field(DSL.name("multiplier"), BigDecimal.class);
    private static final Field<OffsetDateTime> COL_UPD = DSL.field(DSL.name("updated_at"), OffsetDateTime.class);

    private final DSLContext dsl;

    public VoterReputationJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<BigDecimal> findMultiplierByVoterId(UUID voterId) {
        return dsl.select(COL_MULT)
            .from(T)
            .where(COL_ID.eq(voterId))
            .fetchOptional(COL_MULT);
    }

    @Transactional
    public void adjustMultiplier(UUID voterId, BigDecimal delta, BigDecimal min, BigDecimal max) {
        BigDecimal current = findMultiplierByVoterId(voterId).orElse(BigDecimal.ONE);
        BigDecimal newVal = current.add(delta).max(min).min(max);

        dsl.insertInto(T)
            .columns(COL_ID, COL_MULT, COL_UPD)
            .values(voterId, newVal, OffsetDateTime.now())
            .onConflict(COL_ID)
            .doUpdate()
            .set(COL_MULT, newVal)
            .set(COL_UPD, OffsetDateTime.now())
            .execute();
    }
}
