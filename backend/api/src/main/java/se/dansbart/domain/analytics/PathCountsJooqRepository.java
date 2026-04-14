package se.dansbart.domain.analytics;

import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public class PathCountsJooqRepository {

    private final DSLContext dsl;

    // Escape hatches for path_counts — replace with type-safe references after:
    //   ./mvnw generate-sources -Pgenerate-jooq
    private static final Table<?>       PATH_COUNTS = DSL.table("path_counts");
    private static final Field<String>  PC_PATH     = DSL.field("path",  String.class);
    private static final Field<LocalDate> PC_DATE   = DSL.field("date",  LocalDate.class);
    private static final Field<Long>    PC_COUNT    = DSL.field("count", Long.class);

    public PathCountsJooqRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void increment(String path, LocalDate date) {
        dsl.insertInto(PATH_COUNTS)
            .columns(PC_PATH, PC_DATE, PC_COUNT)
            .values(path, date, 1L)
            .onConflict(PC_PATH, PC_DATE)
            .doUpdate()
            .set(PC_COUNT, DSL.field("path_counts.count", Long.class).add(1L))
            .execute();
    }

    /** Top paths by total visits across the given date range, most-visited first. */
    public List<Object[]> topPathsSince(LocalDate since, int limit) {
        return dsl.select(PC_PATH, DSL.sum(PC_COUNT).as("total"))
            .from(PATH_COUNTS)
            .where(PC_DATE.ge(since))
            .groupBy(PC_PATH)
            .orderBy(DSL.sum(PC_COUNT).desc())
            .limit(limit)
            .fetch(r -> new Object[]{
                r.get(PC_PATH),
                r.get("total", Long.class)
            });
    }
}
