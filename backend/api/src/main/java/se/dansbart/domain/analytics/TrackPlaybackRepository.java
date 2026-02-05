package se.dansbart.domain.analytics;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TrackPlaybackRepository extends JpaRepository<TrackPlayback, UUID> {

    /**
     * Get most played tracks with completion rate within a time window.
     * Returns [trackId, playCount, completionRate].
     */
    @Query(value = """
    SELECT tp.track_id,
           COUNT(tp.id) as play_count,
           (SUM(CASE WHEN tp.completed = true THEN 1 ELSE 0 END) * 100.0 / COUNT(tp.id)) as completion_rate
    FROM track_playbacks tp
    WHERE (CAST(:since AS TIMESTAMP) IS NULL OR tp.played_at >= :since)
    GROUP BY tp.track_id
    ORDER BY play_count DESC
    LIMIT :limit
    """, nativeQuery = true)
    List<Object[]> findMostPlayedTracks(
        @Param("since") OffsetDateTime since,
        @Param("limit") int limit
    );

    /**
     * Get play counts by track IDs.
     */
    @Query(value = """
        SELECT tp.track_id, COUNT(tp.id) as play_count
        FROM track_playbacks tp
        WHERE tp.track_id IN :trackIds
        GROUP BY tp.track_id
        """, nativeQuery = true)
    List<Object[]> findPlayCountsByTrackIds(@Param("trackIds") List<UUID> trackIds);

    /**
     * Get total listen time in seconds.
     */
    @Query(value = """
        SELECT COALESCE(SUM(tp.duration_seconds), 0)
        FROM track_playbacks tp
        WHERE (:since IS NULL OR tp.played_at >= :since)
        """, nativeQuery = true)
    Long sumDurationSeconds(@Param("since") OffsetDateTime since);

    /**
     * Get platform usage statistics.
     */
    @Query(value = """
        SELECT tp.platform, COUNT(tp.id) as play_count,
               COALESCE(SUM(tp.duration_seconds), 0) as total_duration
        FROM track_playbacks tp
        WHERE (:since IS NULL OR tp.played_at >= :since)
        GROUP BY tp.platform
        ORDER BY play_count DESC
        """, nativeQuery = true)
    List<Object[]> countByPlatform(@Param("since") OffsetDateTime since);

    /**
     * Get total play count.
     */
    long countByPlayedAtAfter(OffsetDateTime since);
}
