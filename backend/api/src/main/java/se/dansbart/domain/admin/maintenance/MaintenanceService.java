package se.dansbart.domain.admin.maintenance;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.ArtistCrawlLogRepository;
import se.dansbart.domain.admin.RejectionLogRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackRepository;
import se.dansbart.worker.TaskDispatcher;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private final TrackRepository trackRepository;
    private final ArtistCrawlLogRepository crawlLogRepository;
    private final RejectionLogRepository rejectionLogRepository;
    private final StringRedisTemplate redisTemplate;
    private final TaskDispatcher taskDispatcher;

    @Transactional
    public Map<String, Object> resetCrawlData() {
        // This is the nuclear option - use with extreme caution
        int deletedCrawlLogs = 0;
        int deletedRejectionLogs = 0;
        int deletedPendingTracks = 0;
        int deletedOrphanAlbums = 0;
        int deletedOrphanArtists = 0;

        // 1. Flush Redis cache (just clear crawler-related keys)
        try {
            Set<String> keys = redisTemplate.keys("crawler:*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
            }
        } catch (Exception e) {
            // Redis might not be available, continue
        }

        // 2. Delete all crawl logs
        deletedCrawlLogs = (int) crawlLogRepository.count();
        crawlLogRepository.deleteAll();

        // 3. Delete all rejection logs
        deletedRejectionLogs = (int) rejectionLogRepository.count();
        rejectionLogRepository.deleteAll();

        // 4. Delete pending tracks (simplified - would need proper cascade handling)
        List<Track> pendingTracks = trackRepository.findByProcessingStatus("PENDING");
        deletedPendingTracks = pendingTracks.size();
        trackRepository.deleteAll(pendingTracks);

        // 5 & 6. Orphan cleanup would require more complex queries
        // For now, just report what we deleted

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("deleted_crawl_logs", deletedCrawlLogs);
        result.put("deleted_rejection_logs", deletedRejectionLogs);
        result.put("deleted_pending_tracks", deletedPendingTracks);
        result.put("deleted_orphan_albums", deletedOrphanAlbums);
        result.put("deleted_orphan_artists", deletedOrphanArtists);
        result.put("warning", "This is a destructive operation");
        return result;
    }

    @Transactional
    public Map<String, Object> cleanupOrphanedTracks(int stuckThresholdMinutes) {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(stuckThresholdMinutes);

        // Find tracks stuck in PROCESSING for too long
        List<Track> stuckTracks = trackRepository.findByProcessingStatusAndCreatedAtBefore("PROCESSING", threshold);

        int resetCount = 0;
        List<Map<String, Object>> resetTracks = new ArrayList<>();

        for (Track track : stuckTracks) {
            track.setProcessingStatus("PENDING");
            trackRepository.save(track);

            // Re-queue for analysis
            taskDispatcher.dispatchAudioAnalysis(track.getId());

            resetTracks.add(Map.of(
                "id", track.getId().toString(),
                "title", track.getTitle()
            ));
            resetCount++;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("reset_count", resetCount);
        result.put("threshold_minutes", stuckThresholdMinutes);
        result.put("reset_tracks", resetTracks);
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getIsrcStats() {
        long totalTracks = trackRepository.count();
        long withIsrc = trackRepository.countByIsrcNotNull();
        long withoutIsrc = totalTracks - withIsrc;

        // Count fallback ISRCs (those starting with "FALLBACK_")
        long fallbackIsrcs = trackRepository.countByIsrcStartingWith("FALLBACK_");
        long realIsrcs = withIsrc - fallbackIsrcs;

        Map<String, Object> result = new HashMap<>();
        result.put("total_tracks", totalTracks);
        result.put("with_isrc", withIsrc);
        result.put("without_isrc", withoutIsrc);
        result.put("real_isrcs", realIsrcs);
        result.put("fallback_isrcs", fallbackIsrcs);
        result.put("coverage_percent", totalTracks > 0 ? (double) withIsrc / totalTracks * 100 : 0);
        return result;
    }

    @Transactional
    public Map<String, Object> ingestResource(String resourceId, String resourceType) {
        // Validate resource type
        Set<String> validTypes = Set.of("playlist", "album", "artist");
        if (!validTypes.contains(resourceType)) {
            throw new IllegalArgumentException("Invalid resource_type. Must be one of: " + String.join(", ", validTypes));
        }

        // Dispatch appropriate task based on type
        String taskId = UUID.randomUUID().toString();

        // Queue the ingestion task
        taskDispatcher.dispatchSpiderCrawl(resourceId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("task_id", taskId);
        result.put("resource_id", resourceId);
        result.put("resource_type", resourceType);
        result.put("message", "Ingestion task queued");
        return result;
    }

    /**
     * Trigger heuristic reclassification for all tracks.
     * This runs the classification pipeline without re-downloading audio.
     */
    public Map<String, Object> reclassifyAll() {
        String taskId = UUID.randomUUID().toString();

        // Dispatch the reclassify library task
        taskDispatcher.dispatchReclassifyLibrary();

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("task_id", taskId);
        result.put("message", "Library reclassification task queued");
        return result;
    }

    /**
     * Backfill ISRCs from Spotify for tracks missing them.
     */
    public Map<String, Object> backfillIsrcs(int limit) {
        String taskId = UUID.randomUUID().toString();

        // Dispatch the backfill ISRC task to the light worker
        taskDispatcher.dispatchBackfillIsrcs(limit);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("task_id", taskId);
        result.put("limit", limit);
        result.put("message", "ISRC backfill task queued for up to " + limit + " tracks");
        return result;
    }
}
