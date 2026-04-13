package se.dansbart.domain.analytics;

import org.jooq.DatePart;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.jooq.impl.DSL.countDistinct;
import static se.dansbart.jooq.Tables.VISITOR_SESSIONS;

@Repository
public class VisitorSessionJooqRepository {

    private final DSLContext dsl;

    public VisitorSessionJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public Optional<VisitorSession> findBySessionId(String sessionId) {
        return dsl.selectFrom(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.SESSION_ID.eq(sessionId))
            .fetchOptional(this::toVisitorSession);
    }

    @SuppressWarnings("unchecked")
    private static final Field<UUID> USER_ID_FIELD = (Field<UUID>) DSL.field(DSL.name("user_id"), UUID.class);

    public VisitorSession insert(VisitorSession session) {
        UUID id = session.getId() != null ? session.getId() : UUID.randomUUID();
        dsl.insertInto(VISITOR_SESSIONS)
            .columns(
                VISITOR_SESSIONS.ID,
                VISITOR_SESSIONS.SESSION_ID,
                VISITOR_SESSIONS.LAST_SEEN,
                VISITOR_SESSIONS.USER_AGENT,
                VISITOR_SESSIONS.IS_RETURNING,
                VISITOR_SESSIONS.PAGE_VIEWS,
                USER_ID_FIELD
            )
            .values(
                id,
                session.getSessionId(),
                session.getLastSeen(),
                session.getUserAgent(),
                session.getIsReturning(),
                session.getPageViews(),
                session.getUserId()
            )
            .execute();
        session.setId(id);
        return session;
    }

    public VisitorSession update(VisitorSession session) {
        if (session.getId() == null) {
            return insert(session);
        }
        dsl.update(VISITOR_SESSIONS)
            .set(VISITOR_SESSIONS.LAST_SEEN, session.getLastSeen())
            .set(VISITOR_SESSIONS.USER_AGENT, session.getUserAgent())
            .set(VISITOR_SESSIONS.IS_RETURNING, session.getIsReturning())
            .set(VISITOR_SESSIONS.PAGE_VIEWS, session.getPageViews())
            .set(USER_ID_FIELD, session.getUserId())
            .where(VISITOR_SESSIONS.ID.eq(session.getId()))
            .execute();
        return session;
    }

    public long countLoggedInSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(USER_ID_FIELD.isNotNull())
            .fetchOne(0, Long.class);
    }

    public long countAnonymousSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(USER_ID_FIELD.isNull())
            .fetchOne(0, Long.class);
    }

    public long countUniqueSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .fetchOne(0, Long.class);
    }

    public Long sumPageViewsSince(OffsetDateTime since) {
        return dsl.select(org.jooq.impl.DSL.sum(VISITOR_SESSIONS.PAGE_VIEWS))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .fetchOne(0, Long.class);
    }

    /**
     * Returns [hour, total, loggedIn, anonymous] for each hour of day that had visits.
     */
    public List<Object[]> countByHourOfDayWithTypes(OffsetDateTime since) {
        var hour = DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR).as("hour");
        var total = countDistinct(VISITOR_SESSIONS.SESSION_ID).as("total");
        var loggedIn = countDistinct(
            DSL.when(USER_ID_FIELD.isNotNull(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("logged_in");
        var anonymous = countDistinct(
            DSL.when(USER_ID_FIELD.isNull(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("anonymous");
        return dsl.select(hour, total, loggedIn, anonymous)
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .orderBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .fetch(r -> new Object[]{
                r.get("hour"),
                r.get("total", Long.class),
                r.get("logged_in", Long.class),
                r.get("anonymous", Long.class)
            });
    }

    public List<Object[]> countByHourOfDay(OffsetDateTime since) {
        return dsl.select(
                DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR).as("hour"),
                DSL.count().as("count")
            )
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .orderBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .fetch(r -> new Object[]{
                r.get("hour"),
                r.get("count", Long.class)
            });
    }

    public List<Object[]> countByDate(OffsetDateTime since) {
        return dsl.select(
                org.jooq.impl.DSL.field("DATE(first_seen)"),
                org.jooq.impl.DSL.count().as("count")
            )
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(org.jooq.impl.DSL.field("DATE(first_seen)"))
            .orderBy(org.jooq.impl.DSL.field("DATE(first_seen)"))
            .fetch(r -> new Object[]{
                r.get(0),
                r.get("count", Long.class)
            });
    }

    /**
     * Returns [date, total, loggedIn, anonymous] for each day that had visits.
     */
    public List<Object[]> countByDateWithTypes(OffsetDateTime since) {
        var dateField = org.jooq.impl.DSL.field("DATE(first_seen)");
        var total = countDistinct(VISITOR_SESSIONS.SESSION_ID).as("total");
        var loggedIn = countDistinct(
            DSL.when(USER_ID_FIELD.isNotNull(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("logged_in");
        var anonymous = countDistinct(
            DSL.when(USER_ID_FIELD.isNull(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("anonymous");
        return dsl.select(dateField, total, loggedIn, anonymous)
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(dateField)
            .orderBy(dateField)
            .fetch(r -> new Object[]{
                r.get(0),
                r.get("total", Long.class),
                r.get("logged_in", Long.class),
                r.get("anonymous", Long.class)
            });
    }

    private VisitorSession toVisitorSession(Record r) {
        VisitorSession vs = new VisitorSession();
        vs.setId(r.get(VISITOR_SESSIONS.ID));
        vs.setSessionId(r.get(VISITOR_SESSIONS.SESSION_ID));
        vs.setFirstSeen(r.get(VISITOR_SESSIONS.FIRST_SEEN));
        vs.setLastSeen(r.get(VISITOR_SESSIONS.LAST_SEEN));
        vs.setUserAgent(r.get(VISITOR_SESSIONS.USER_AGENT));
        vs.setIsReturning(Boolean.TRUE.equals(r.get(VISITOR_SESSIONS.IS_RETURNING)));
        vs.setPageViews(r.get(VISITOR_SESSIONS.PAGE_VIEWS));
        try { vs.setUserId(r.get(USER_ID_FIELD)); } catch (Exception ignored) {}
        return vs;
    }
}

