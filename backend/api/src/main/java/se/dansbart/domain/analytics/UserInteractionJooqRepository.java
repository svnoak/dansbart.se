package se.dansbart.domain.analytics;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.io.UncheckedIOException;
import java.util.List;
import java.util.UUID;

import static org.jooq.impl.DSL.count;
import static se.dansbart.jooq.Tables.USER_INTERACTIONS;

@Repository
public class UserInteractionJooqRepository {

    private final DSLContext dsl;
    private final ObjectMapper objectMapper;

    public UserInteractionJooqRepository(DSLContext dsl, ObjectMapper objectMapper) {
        this.dsl = dsl;
        this.objectMapper = objectMapper;
    }

    public UserInteraction insert(UserInteraction interaction) {
        UUID id = interaction.getId() != null ? interaction.getId() : UUID.randomUUID();
        JSONB eventJson = null;
        if (interaction.getEventData() != null) {
            try {
                eventJson = JSONB.jsonb(objectMapper.writeValueAsString(interaction.getEventData()));
            } catch (JsonProcessingException e) {
                throw new UncheckedIOException(e);
            }
        }
        dsl.insertInto(USER_INTERACTIONS)
            .columns(
                USER_INTERACTIONS.ID,
                USER_INTERACTIONS.TRACK_ID,
                USER_INTERACTIONS.EVENT_TYPE,
                USER_INTERACTIONS.EVENT_DATA,
                USER_INTERACTIONS.SESSION_ID
            )
            .values(
                id,
                interaction.getTrackId(),
                interaction.getEventType(),
                eventJson,
                interaction.getSessionId()
            )
            .execute();
        interaction.setId(id);
        return interaction;
    }

    /**
     * Returns [event_type, count] for report_* events since the given time.
     */
    public List<Object[]> countReportsByType(java.time.OffsetDateTime since) {
        return dsl.select(
                USER_INTERACTIONS.EVENT_TYPE,
                count(USER_INTERACTIONS.ID).as("count")
            )
            .from(USER_INTERACTIONS)
            .where(USER_INTERACTIONS.EVENT_TYPE.like("report_%")
                .and(since == null ? org.jooq.impl.DSL.noCondition() : USER_INTERACTIONS.CREATED_AT.ge(since)))
            .groupBy(USER_INTERACTIONS.EVENT_TYPE)
            .fetch(r -> new Object[]{
                r.get(USER_INTERACTIONS.EVENT_TYPE),
                r.get("count", Long.class)
            });
    }

    /**
     * Returns [event_type, count] for events matching the given prefix since the given time.
     */
    public List<Object[]> countEventsByPrefix(String prefix, java.time.OffsetDateTime since) {
        return dsl.select(
                USER_INTERACTIONS.EVENT_TYPE,
                count(USER_INTERACTIONS.ID).as("count")
            )
            .from(USER_INTERACTIONS)
            .where(USER_INTERACTIONS.EVENT_TYPE.like(prefix + "%")
                .and(since == null ? org.jooq.impl.DSL.noCondition() : USER_INTERACTIONS.CREATED_AT.ge(since)))
            .groupBy(USER_INTERACTIONS.EVENT_TYPE)
            .fetch(r -> new Object[]{
                r.get(USER_INTERACTIONS.EVENT_TYPE),
                r.get("count", Long.class)
            });
    }

    /**
     * Returns [event_type, count] for discovery_* events since the given time.
     */
    public List<Object[]> countDiscoveryEvents(java.time.OffsetDateTime since) {
        return dsl.select(
                USER_INTERACTIONS.EVENT_TYPE,
                count(USER_INTERACTIONS.ID).as("count")
            )
            .from(USER_INTERACTIONS)
            .where(USER_INTERACTIONS.EVENT_TYPE.like("discovery_%")
                .and(since == null ? org.jooq.impl.DSL.noCondition() : USER_INTERACTIONS.CREATED_AT.ge(since)))
            .groupBy(USER_INTERACTIONS.EVENT_TYPE)
            .fetch(r -> new Object[]{
                r.get(USER_INTERACTIONS.EVENT_TYPE),
                r.get("count", Long.class)
            });
    }

    /**
     * Aggregate stats for search events. Queries JSONB event_data fields.
     * Returns a single row: [total, withQuery, withStyle, withTempo, withDuration, withBounciness, withArticulation]
     */
    public Object[] getSearchStats(java.time.OffsetDateTime since) {
        var condition = USER_INTERACTIONS.EVENT_TYPE.eq("search")
            .and(since == null ? org.jooq.impl.DSL.noCondition() : USER_INTERACTIONS.CREATED_AT.ge(since));

        var total          = count(USER_INTERACTIONS.ID).as("total");
        var withQuery      = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'hasQuery'").eq("true")).as("with_query");
        var withStyle      = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'style'").isNotNull()).as("with_style");
        var withTempo      = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'hasTempoFilter'").eq("true")).as("with_tempo");
        var withDuration   = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'hasDurationFilter'").eq("true")).as("with_duration");
        var withBounciness = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'hasBouncinessFilter'").eq("true")).as("with_bounciness");
        var withArtic      = org.jooq.impl.DSL.count().filterWhere(
            org.jooq.impl.DSL.field("event_data->>'hasArticulationFilter'").eq("true")).as("with_articulation");

        return dsl.select(total, withQuery, withStyle, withTempo, withDuration, withBounciness, withArtic)
            .from(USER_INTERACTIONS)
            .where(condition)
            .fetchOne(r -> new Object[]{
                r.get("total",           Long.class),
                r.get("with_query",      Long.class),
                r.get("with_style",      Long.class),
                r.get("with_tempo",      Long.class),
                r.get("with_duration",   Long.class),
                r.get("with_bounciness", Long.class),
                r.get("with_articulation", Long.class)
            });
    }

    /**
     * Returns [style, count] for the top styles searched, most searched first.
     */
    public List<Object[]> getTopSearchedStyles(java.time.OffsetDateTime since, int limit) {
        var condition = USER_INTERACTIONS.EVENT_TYPE.eq("search")
            .and(org.jooq.impl.DSL.field("event_data->>'style'").isNotNull())
            .and(since == null ? org.jooq.impl.DSL.noCondition() : USER_INTERACTIONS.CREATED_AT.ge(since));

        return dsl.select(
                org.jooq.impl.DSL.field("event_data->>'style'").as("style"),
                count(USER_INTERACTIONS.ID).as("count")
            )
            .from(USER_INTERACTIONS)
            .where(condition)
            .groupBy(org.jooq.impl.DSL.field("event_data->>'style'"))
            .orderBy(count(USER_INTERACTIONS.ID).desc())
            .limit(limit)
            .fetch(r -> new Object[]{
                r.get("style"),
                r.get("count", Long.class)
            });
    }

    private UserInteraction toUserInteraction(Record r) {
        UserInteraction ui = new UserInteraction();
        ui.setId(r.get(USER_INTERACTIONS.ID));
        ui.setTrackId(r.get(USER_INTERACTIONS.TRACK_ID));
        ui.setEventType(r.get(USER_INTERACTIONS.EVENT_TYPE));
        ui.setSessionId(r.get(USER_INTERACTIONS.SESSION_ID));
        ui.setCreatedAt(r.get(USER_INTERACTIONS.CREATED_AT));
        // eventData left null when reading (not needed for current services)
        return ui;
    }
}

