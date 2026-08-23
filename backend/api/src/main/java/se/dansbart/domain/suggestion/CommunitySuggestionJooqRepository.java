package se.dansbart.domain.suggestion;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.JSONB;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.io.UncheckedIOException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * jOOQ repository for community_suggestions (added in V20). Uses dynamic DSL rather than
 * a generated table binding since this table was added without access to a live database
 * to run `./mvnw generate-sources -Pgenerate-jooq`. Once that's been run, this can be
 * rewritten against the generated COMMUNITY_SUGGESTIONS table for full type safety.
 */
@Repository
public class CommunitySuggestionJooqRepository {

    private static final Table<?> T = DSL.table("community_suggestions");
    private static final Field<UUID> ID = DSL.field(DSL.name("id"), UUID.class);
    private static final Field<String> KIND = DSL.field(DSL.name("kind"), String.class);
    private static final Field<JSONB> PAYLOAD = DSL.field(DSL.name("payload"), JSONB.class);
    private static final Field<String> NOTE = DSL.field(DSL.name("note"), String.class);
    private static final Field<UUID> VOTER_ID = DSL.field(DSL.name("voter_id"), UUID.class);
    private static final Field<String> STATUS = DSL.field(DSL.name("status"), String.class);
    private static final Field<UUID> REVIEWED_BY = DSL.field(DSL.name("reviewed_by"), UUID.class);
    private static final Field<OffsetDateTime> REVIEWED_AT = DSL.field(DSL.name("reviewed_at"), OffsetDateTime.class);
    private static final Field<String> REVIEW_NOTE = DSL.field(DSL.name("review_note"), String.class);
    private static final Field<UUID> RESOLVED_REF_ID = DSL.field(DSL.name("resolved_ref_id"), UUID.class);
    private static final Field<OffsetDateTime> ACTIVATED_AT = DSL.field(DSL.name("activated_at"), OffsetDateTime.class);
    private static final Field<OffsetDateTime> CREATED_AT = DSL.field(DSL.name("created_at"), OffsetDateTime.class);

    private final DSLContext dsl;
    private final ObjectMapper objectMapper;

    public CommunitySuggestionJooqRepository(DSLContext dsl, ObjectMapper objectMapper) {
        this.dsl = dsl;
        this.objectMapper = objectMapper;
    }

    public CommunitySuggestion save(CommunitySuggestion s) {
        JSONB json = toJsonb(s.getPayload());
        if (s.getId() == null) {
            UUID id = UUID.randomUUID();
            dsl.insertInto(T)
                .columns(ID, KIND, PAYLOAD, NOTE, VOTER_ID, STATUS)
                .values(id, s.getKind(), json, s.getNote(), s.getVoterId(), s.getStatus())
                .execute();
            s.setId(id);
        } else {
            dsl.update(T)
                .set(PAYLOAD, json)
                .set(NOTE, s.getNote())
                .where(ID.eq(s.getId()))
                .execute();
        }
        return s;
    }

    public Optional<CommunitySuggestion> findById(UUID id) {
        return dsl.select(ID, KIND, PAYLOAD, NOTE, VOTER_ID, STATUS, REVIEWED_BY, REVIEWED_AT,
                REVIEW_NOTE, RESOLVED_REF_ID, ACTIVATED_AT, CREATED_AT)
            .from(T)
            .where(ID.eq(id))
            .fetchOptional(this::toSuggestion);
    }

    public List<CommunitySuggestion> findPage(String kind, String status, int limit, int offset) {
        var where = DSL.noCondition();
        if (kind != null && !kind.isBlank()) where = where.and(KIND.eq(kind));
        if (status != null && !status.isBlank()) where = where.and(STATUS.eq(status));

        return dsl.select(ID, KIND, PAYLOAD, NOTE, VOTER_ID, STATUS, REVIEWED_BY, REVIEWED_AT,
                REVIEW_NOTE, RESOLVED_REF_ID, ACTIVATED_AT, CREATED_AT)
            .from(T)
            .where(where)
            .orderBy(CREATED_AT.desc())
            .limit(limit)
            .offset(offset)
            .fetch(this::toSuggestion);
    }

    public long count(String kind, String status) {
        var where = DSL.noCondition();
        if (kind != null && !kind.isBlank()) where = where.and(KIND.eq(kind));
        if (status != null && !status.isBlank()) where = where.and(STATUS.eq(status));
        return dsl.fetchCount(dsl.selectFrom(T).where(where));
    }

    public void markReviewed(UUID id, String status, UUID reviewedBy, String reviewNote) {
        dsl.update(T)
            .set(STATUS, status)
            .set(REVIEWED_BY, reviewedBy)
            .set(REVIEWED_AT, OffsetDateTime.now())
            .set(REVIEW_NOTE, reviewNote)
            .where(ID.eq(id))
            .execute();
    }

    public void markActivated(UUID id, UUID resolvedRefId) {
        dsl.update(T)
            .set(STATUS, "activated")
            .set(ACTIVATED_AT, OffsetDateTime.now())
            .set(RESOLVED_REF_ID, resolvedRefId)
            .where(ID.eq(id))
            .execute();
    }

    private JSONB toJsonb(Map<String, Object> payload) {
        try {
            return JSONB.jsonb(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private CommunitySuggestion toSuggestion(Record r) {
        Map<String, Object> payload = Map.of();
        JSONB json = r.get(PAYLOAD);
        if (json != null) {
            try {
                payload = objectMapper.readValue(json.data(), Map.class);
            } catch (Exception e) {
                // Leave payload empty rather than failing the whole query on one bad row.
                payload = Map.of();
            }
        }
        return CommunitySuggestion.builder()
            .id(r.get(ID))
            .kind(r.get(KIND))
            .payload(payload)
            .note(r.get(NOTE))
            .voterId(r.get(VOTER_ID))
            .status(r.get(STATUS))
            .reviewedBy(r.get(REVIEWED_BY))
            .reviewedAt(r.get(REVIEWED_AT))
            .reviewNote(r.get(REVIEW_NOTE))
            .resolvedRefId(r.get(RESOLVED_REF_ID))
            .activatedAt(r.get(ACTIVATED_AT))
            .createdAt(r.get(CREATED_AT))
            .build();
    }
}
