package se.dansbart.domain.analytics;

import org.jooq.DatePart;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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

    // Escape hatches for columns added after last jOOQ codegen run.
    // Replace with VISITOR_SESSIONS.* references after running:
    //   ./mvnw generate-sources -Pgenerate-jooq
    private static final Field<Boolean> IS_AUTHENTICATED_FIELD = DSL.field(DSL.name("is_authenticated"), Boolean.class);
    private static final Field<String>  DEVICE_TYPE_FIELD       = DSL.field(DSL.name("device_type"),      String.class);
    private static final Field<Boolean> USED_SEARCH_FIELD       = DSL.field(DSL.name("used_search"),      Boolean.class);
    private static final Field<Boolean> USED_PLAYLISTS_FIELD    = DSL.field(DSL.name("used_playlists"),   Boolean.class);
    private static final Field<Boolean> USED_LIBRARY_FIELD      = DSL.field(DSL.name("used_library"),     Boolean.class);
    private static final Field<Boolean> USED_DISCOVERY_FIELD    = DSL.field(DSL.name("used_discovery"),   Boolean.class);

    public Optional<VisitorSession> findBySessionId(String sessionId) {
        return dsl.selectFrom(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.SESSION_ID.eq(sessionId))
            .fetchOptional(this::toVisitorSession);
    }

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
                IS_AUTHENTICATED_FIELD,
                DEVICE_TYPE_FIELD,
                USED_SEARCH_FIELD,
                USED_PLAYLISTS_FIELD,
                USED_LIBRARY_FIELD,
                USED_DISCOVERY_FIELD
            )
            .values(
                id,
                session.getSessionId(),
                session.getLastSeen(),
                session.getUserAgent(),
                session.getIsReturning(),
                session.getPageViews(),
                Boolean.TRUE.equals(session.getIsAuthenticated()),
                session.getDeviceType(),
                Boolean.TRUE.equals(session.getUsedSearch()),
                Boolean.TRUE.equals(session.getUsedPlaylists()),
                Boolean.TRUE.equals(session.getUsedLibrary()),
                Boolean.TRUE.equals(session.getUsedDiscovery())
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
            // Only ever flip to true — never demote an authenticated session back to anonymous.
            .set(IS_AUTHENTICATED_FIELD, DSL.when(IS_AUTHENTICATED_FIELD.isTrue(), true)
                .otherwise(Boolean.TRUE.equals(session.getIsAuthenticated())))
            .set(DEVICE_TYPE_FIELD, session.getDeviceType())
            .where(VISITOR_SESSIONS.ID.eq(session.getId()))
            .execute();
        return session;
    }

    /**
     * Flip a single behavioral area flag to true for a session. Idempotent.
     * Area must be one of: search, playlists, library, discovery.
     */
    public void setSessionFlag(String sessionId, String area) {
        Field<Boolean> flagField = switch (area) {
            case "search"    -> USED_SEARCH_FIELD;
            case "playlists" -> USED_PLAYLISTS_FIELD;
            case "library"   -> USED_LIBRARY_FIELD;
            case "discovery" -> USED_DISCOVERY_FIELD;
            default -> throw new IllegalArgumentException("Unknown behavioral area: " + area);
        };
        dsl.update(VISITOR_SESSIONS)
            .set(flagField, true)
            .where(VISITOR_SESSIONS.SESSION_ID.eq(sessionId))
            .execute();
    }

    // --- Count queries ---

    public long countUniqueSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .fetchOne(0, Long.class);
    }

    public Long sumPageViewsSince(OffsetDateTime since) {
        return dsl.select(DSL.sum(VISITOR_SESSIONS.PAGE_VIEWS))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .fetchOne(0, Long.class);
    }

    public long countAuthenticatedSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(IS_AUTHENTICATED_FIELD.isTrue())
            .fetchOne(0, Long.class);
    }

    public long countAnonymousSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(IS_AUTHENTICATED_FIELD.isFalse())
            .fetchOne(0, Long.class);
    }

    public long countMobileSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(DEVICE_TYPE_FIELD.eq("mobile"))
            .fetchOne(0, Long.class);
    }

    public long countDesktopSessionsSince(OffsetDateTime since) {
        return dsl.select(countDistinct(VISITOR_SESSIONS.SESSION_ID))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(DEVICE_TYPE_FIELD.eq("desktop"))
            .fetchOne(0, Long.class);
    }

    // --- Session duration ---

    /** Average session duration in seconds over the given time window.
     *  Only counts sessions with more than one page view (last_seen > first_seen). */
    public Double avgSessionDurationSecondsSince(OffsetDateTime since) {
        var duration = DSL.field(
            "EXTRACT(EPOCH FROM ({0} - {1}))",
            Double.class,
            VISITOR_SESSIONS.LAST_SEEN,
            VISITOR_SESSIONS.FIRST_SEEN
        );
        return dsl.select(DSL.avg(duration))
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .and(VISITOR_SESSIONS.LAST_SEEN.gt(VISITOR_SESSIONS.FIRST_SEEN))
            .fetchOne(0, Double.class);
    }

    // --- Behavioral flags ---

    /** Returns total sessions that touched each area, plus a breakdown by device type. */
    public Map<String, Long> behavioralFlagCountsSince(OffsetDateTime since) {
        var row = dsl.select(
                DSL.sum(DSL.when(USED_SEARCH_FIELD.isTrue(),    1).otherwise(0)).as("used_search"),
                DSL.sum(DSL.when(USED_PLAYLISTS_FIELD.isTrue(), 1).otherwise(0)).as("used_playlists"),
                DSL.sum(DSL.when(USED_LIBRARY_FIELD.isTrue(),   1).otherwise(0)).as("used_library"),
                DSL.sum(DSL.when(USED_DISCOVERY_FIELD.isTrue(), 1).otherwise(0)).as("used_discovery")
            )
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .fetchOne();
        if (row == null) return Map.of("usedSearch", 0L, "usedPlaylists", 0L, "usedLibrary", 0L, "usedDiscovery", 0L);
        return Map.of(
            "usedSearch",    row.get("used_search",    Long.class),
            "usedPlaylists", row.get("used_playlists", Long.class),
            "usedLibrary",   row.get("used_library",   Long.class),
            "usedDiscovery", row.get("used_discovery", Long.class)
        );
    }

    /** Returns [deviceType, total, usedSearch, usedPlaylists, usedLibrary, usedDiscovery]. */
    public List<Object[]> behavioralFlagsByDeviceTypeSince(OffsetDateTime since) {
        return dsl.select(
                DEVICE_TYPE_FIELD,
                DSL.count().as("total"),
                DSL.sum(DSL.when(USED_SEARCH_FIELD.isTrue(),    1).otherwise(0)).as("used_search"),
                DSL.sum(DSL.when(USED_PLAYLISTS_FIELD.isTrue(), 1).otherwise(0)).as("used_playlists"),
                DSL.sum(DSL.when(USED_LIBRARY_FIELD.isTrue(),   1).otherwise(0)).as("used_library"),
                DSL.sum(DSL.when(USED_DISCOVERY_FIELD.isTrue(), 1).otherwise(0)).as("used_discovery")
            )
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(DEVICE_TYPE_FIELD)
            .fetch(r -> new Object[]{
                r.get(DEVICE_TYPE_FIELD),
                r.get("total",         Long.class),
                r.get("used_search",    Long.class),
                r.get("used_playlists", Long.class),
                r.get("used_library",   Long.class),
                r.get("used_discovery", Long.class)
            });
    }

    // --- Hourly / daily with auth breakdown ---

    /** Returns [hour, total, authenticated, anonymous] for each hour of day that had visits. */
    public List<Object[]> countByHourOfDayWithTypes(OffsetDateTime since) {
        var hour = DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR).as("hour");
        var total = countDistinct(VISITOR_SESSIONS.SESSION_ID).as("total");
        var authenticated = countDistinct(
            DSL.when(IS_AUTHENTICATED_FIELD.isTrue(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("authenticated");
        var anonymous = countDistinct(
            DSL.when(IS_AUTHENTICATED_FIELD.isFalse(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("anonymous");
        return dsl.select(hour, total, authenticated, anonymous)
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .orderBy(DSL.extract(VISITOR_SESSIONS.FIRST_SEEN, DatePart.HOUR))
            .fetch(r -> new Object[]{
                r.get("hour"),
                r.get("total",         Long.class),
                r.get("authenticated", Long.class),
                r.get("anonymous",     Long.class)
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
                DSL.field("DATE(first_seen)"),
                DSL.count().as("count")
            )
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(DSL.field("DATE(first_seen)"))
            .orderBy(DSL.field("DATE(first_seen)"))
            .fetch(r -> new Object[]{
                r.get(0),
                r.get("count", Long.class)
            });
    }

    /** Returns [date, total, authenticated, anonymous] for each day that had visits. */
    public List<Object[]> countByDateWithTypes(OffsetDateTime since) {
        var dateField = DSL.field("DATE(first_seen)");
        var total = countDistinct(VISITOR_SESSIONS.SESSION_ID).as("total");
        var authenticated = countDistinct(
            DSL.when(IS_AUTHENTICATED_FIELD.isTrue(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("authenticated");
        var anonymous = countDistinct(
            DSL.when(IS_AUTHENTICATED_FIELD.isFalse(), VISITOR_SESSIONS.SESSION_ID).otherwise((String) null)
        ).as("anonymous");
        return dsl.select(dateField, total, authenticated, anonymous)
            .from(VISITOR_SESSIONS)
            .where(VISITOR_SESSIONS.FIRST_SEEN.ge(since))
            .groupBy(dateField)
            .orderBy(dateField)
            .fetch(r -> new Object[]{
                r.get(0),
                r.get("total",         Long.class),
                r.get("authenticated", Long.class),
                r.get("anonymous",     Long.class)
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
        try { vs.setIsAuthenticated(r.get(IS_AUTHENTICATED_FIELD)); } catch (Exception ignored) {}
        try { vs.setDeviceType(r.get(DEVICE_TYPE_FIELD)); }           catch (Exception ignored) {}
        try { vs.setUsedSearch(r.get(USED_SEARCH_FIELD)); }           catch (Exception ignored) {}
        try { vs.setUsedPlaylists(r.get(USED_PLAYLISTS_FIELD)); }     catch (Exception ignored) {}
        try { vs.setUsedLibrary(r.get(USED_LIBRARY_FIELD)); }         catch (Exception ignored) {}
        try { vs.setUsedDiscovery(r.get(USED_DISCOVERY_FIELD)); }     catch (Exception ignored) {}
        return vs;
    }
}
