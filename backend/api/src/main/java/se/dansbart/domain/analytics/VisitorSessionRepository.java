package se.dansbart.domain.analytics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VisitorSessionRepository extends JpaRepository<VisitorSession, UUID> {

    Optional<VisitorSession> findBySessionId(String sessionId);

    long countByFirstSeenAfter(OffsetDateTime since);

    long countByIsReturningTrue();

    @Query("SELECT COUNT(DISTINCT v.sessionId) FROM VisitorSession v WHERE v.firstSeen >= :since")
    long countUniqueSessionsSince(@Param("since") OffsetDateTime since);

    @Query("SELECT SUM(v.pageViews) FROM VisitorSession v WHERE v.firstSeen >= :since")
    Long sumPageViewsSince(@Param("since") OffsetDateTime since);

    @Query(value = """
        SELECT EXTRACT(HOUR FROM first_seen) as hour, COUNT(*) as count
        FROM visitor_sessions
        WHERE first_seen >= :since
        GROUP BY EXTRACT(HOUR FROM first_seen)
        ORDER BY hour
        """, nativeQuery = true)
    List<Object[]> countByHourOfDay(@Param("since") OffsetDateTime since);

    @Query(value = """
        SELECT DATE(first_seen) as date, COUNT(*) as count
        FROM visitor_sessions
        WHERE first_seen >= :since
        GROUP BY DATE(first_seen)
        ORDER BY date
        """, nativeQuery = true)
    List<Object[]> countByDate(@Param("since") OffsetDateTime since);
}
