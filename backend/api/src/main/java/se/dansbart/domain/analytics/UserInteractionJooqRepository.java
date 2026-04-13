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

