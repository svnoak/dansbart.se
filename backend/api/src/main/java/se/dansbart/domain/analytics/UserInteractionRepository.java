package se.dansbart.domain.analytics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserInteractionRepository extends JpaRepository<UserInteraction, UUID> {

    long countByEventTypeAndCreatedAtAfter(String eventType, OffsetDateTime since);

    @Query(value = """
        SELECT ui.event_type, COUNT(ui.id) as count
        FROM user_interactions ui
        WHERE (:since IS NULL OR ui.created_at >= :since)
        GROUP BY ui.event_type
        ORDER BY count DESC
        """, nativeQuery = true)
    List<Object[]> countByEventType(@Param("since") OffsetDateTime since);

    @Query(value = """
        SELECT ui.event_type, COUNT(ui.id) as count
        FROM user_interactions ui
        WHERE ui.event_type LIKE 'report_%'
        AND (:since IS NULL OR ui.created_at >= :since)
        GROUP BY ui.event_type
        """, nativeQuery = true)
    List<Object[]> countReportsByType(@Param("since") OffsetDateTime since);

    @Query(value = """
        SELECT ui.event_type, COUNT(ui.id) as count
        FROM user_interactions ui
        WHERE ui.event_type LIKE 'discovery_%'
        AND (:since IS NULL OR ui.created_at >= :since)
        GROUP BY ui.event_type
        """, nativeQuery = true)
    List<Object[]> countDiscoveryEvents(@Param("since") OffsetDateTime since);
}
