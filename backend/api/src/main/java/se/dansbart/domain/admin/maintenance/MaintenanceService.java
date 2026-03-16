package se.dansbart.domain.admin.maintenance;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.ArtistCrawlLogJooqRepository;
import se.dansbart.domain.admin.RejectionLogJooqRepository;
import se.dansbart.domain.track.Track;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import org.springframework.data.domain.PageRequest;

import java.time.OffsetDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MaintenanceService {

    private final TrackJooqRepository trackJooqRepository;
    private final ArtistCrawlLogJooqRepository crawlLogRepository;
    private final RejectionLogJooqRepository rejectionLogJooqRepository;
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
        deletedCrawlLogs = (int) crawlLogRepository.countLogs();
        crawlLogRepository.deleteAll();

        // 3. Delete all rejection logs
        deletedRejectionLogs = (int) rejectionLogJooqRepository.count();
        rejectionLogJooqRepository.deleteAll();

        // 4. Delete pending tracks (simplified - would need proper cascade handling)
        List<Track> pendingTracks = trackJooqRepository.findByProcessingStatus("PENDING");
        deletedPendingTracks = pendingTracks.size();
        trackJooqRepository.deleteAllById(pendingTracks.stream().map(Track::getId).toList());

        // 5 & 6. Orphan cleanup would require more complex queries
        // For now, just report what we deleted

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("deletedCrawlLogs", deletedCrawlLogs);
        result.put("deletedRejectionLogs", deletedRejectionLogs);
        result.put("deletedPendingTracks", deletedPendingTracks);
        result.put("deletedOrphanAlbums", deletedOrphanAlbums);
        result.put("deletedOrphanArtists", deletedOrphanArtists);
        result.put("warning", "This is a destructive operation");
        return result;
    }

    /**
     * Queue tracks for audio analysis by processing status.
     * Supports PENDING (default) and FAILED. FAILED tracks are reset to PENDING before dispatch.
     */
    @Transactional
    public Map<String, Object> queuePendingTracksForAnalysis(int limit, String status) {
        String normalizedStatus = status.toUpperCase();
        if (!Set.of("PENDING", "FAILED").contains(normalizedStatus)) {
            throw new IllegalArgumentException("Unsupported status: " + status + ". Must be PENDING or FAILED.");
        }

        List<UUID> ids = trackJooqRepository.findIdsByProcessingStatusOrderByCreatedAtAsc(normalizedStatus, limit);

        if (!ids.isEmpty() && "FAILED".equals(normalizedStatus)) {
            trackJooqRepository.setProcessingStatusBatch(ids, "PENDING");
        }

        for (UUID id : ids) {
            taskDispatcher.dispatchAudioAnalysis(id);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("queued", ids.size());
        result.put("sourceStatus", normalizedStatus);
        result.put("message", "Queued " + ids.size() + " " + normalizedStatus + " tracks for audio analysis");
        return result;
    }

    @Transactional
    public Map<String, Object> cleanupOrphanedTracks(int stuckThresholdMinutes) {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(stuckThresholdMinutes);

        // Find tracks stuck in PROCESSING for too long
        List<UUID> stuckIds = trackJooqRepository.findIdsByProcessingStatusAndCreatedAtBefore("PROCESSING", threshold);

        int resetCount = 0;
        List<Map<String, Object>> resetTracks = new ArrayList<>();

        if (!stuckIds.isEmpty()) {
            trackJooqRepository.setProcessingStatusBatch(stuckIds, "PENDING");
            List<Track> stuckTracks = trackJooqRepository.findByIds(stuckIds);
            for (Track track : stuckTracks) {
                taskDispatcher.dispatchAudioAnalysis(track.getId());
                resetTracks.add(Map.of(
                    "id", track.getId().toString(),
                    "title", track.getTitle()
                ));
                resetCount++;
            }
        }

        // Find tracks stuck in REANALYZING for too long -- reset to DONE (old data is valid)
        List<UUID> stuckReanalyzingIds = trackJooqRepository.findIdsByProcessingStatusAndCreatedAtBefore("REANALYZING", threshold);
        int reanalyzingResetCount = 0;
        if (!stuckReanalyzingIds.isEmpty()) {
            trackJooqRepository.setProcessingStatusBatch(stuckReanalyzingIds, "DONE");
            reanalyzingResetCount = stuckReanalyzingIds.size();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("resetCount", resetCount);
        result.put("reanalyzingResetCount", reanalyzingResetCount);
        result.put("thresholdMinutes", stuckThresholdMinutes);
        result.put("resetTracks", resetTracks);
        return result;
    }

    /**
     * Queue DONE tracks for re-analysis using the REANALYZING status.
     * Tracks remain visible in search results while being re-analyzed.
     */
    @Transactional
    public Map<String, Object> reanalyzeTracksForAnalysis(int limit) {
        List<UUID> ids = trackJooqRepository.findIdsByProcessingStatusOrderByCreatedAtAsc("DONE", limit);

        if (!ids.isEmpty()) {
            trackJooqRepository.setProcessingStatusBatch(ids, "REANALYZING");
            for (UUID id : ids) {
                taskDispatcher.dispatchAudioAnalysis(id);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("status", "success");
        result.put("queued", ids.size());
        result.put("message", "Queued " + ids.size() + " tracks for re-analysis (REANALYZING)");
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getIsrcStats() {
        long totalTracks = trackJooqRepository.countTracks();
        long withIsrc = trackJooqRepository.countByIsrcNotNull();
        long withoutIsrc = totalTracks - withIsrc;

        // Count fallback ISRCs (those starting with "FALLBACK_")
        long fallbackIsrcs = trackJooqRepository.countByIsrcStartingWith("FALLBACK_");
        long realIsrcs = withIsrc - fallbackIsrcs;

        Map<String, Object> result = new HashMap<>();
        result.put("totalTracks", totalTracks);
        result.put("withIsrc", withIsrc);
        result.put("withoutIsrc", withoutIsrc);
        result.put("realIsrcs", realIsrcs);
        result.put("fallbackIsrcs", fallbackIsrcs);
        result.put("coveragePercent", totalTracks > 0 ? (double) withIsrc / totalTracks * 100 : 0);
        return result;
    }

    @Transactional
    public Map<String, Object> ingestResource(String resourceId, String resourceType) {
        if (resourceId == null || resourceId.isBlank()) {
            throw new IllegalArgumentException("resourceId is required");
        }
        // Validate resource type
        Set<String> validTypes = Set.of("playlist", "album", "artist");
        if (!validTypes.contains(resourceType)) {
            throw new IllegalArgumentException("Invalid resourceType. Must be one of: " + String.join(", ", validTypes));
        }

        // Dispatch Spotify ingestion task (playlist, album, or artist) to light worker
        String taskId = UUID.randomUUID().toString();
        taskDispatcher.dispatchSpotifyIngest(resourceType, resourceId);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("resourceId", resourceId);
        result.put("resourceType", resourceType);
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
        result.put("taskId", taskId);
        result.put("message", "Library reclassification task queued");
        return result;
    }

    /**
     * Trigger model retraining from user-confirmed and high-confidence tracks.
     * Bypasses the debounce cooldown (admin-only operation).
     */
    public Map<String, Object> retrainModel(boolean reclassifyAfter) {
        String taskId = UUID.randomUUID().toString();

        taskDispatcher.dispatchRetrainModel(reclassifyAfter);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("taskId", taskId);
        result.put("reclassifyAfter", reclassifyAfter);
        result.put("message", "Model retrain task queued");
        return result;
    }

    public Map<String, Object> pauseQueue(String queue) {
        taskDispatcher.setPaused(queue, true);
        taskDispatcher.purgeQueue(queue);
        return Map.of(
            "status", "paused",
            "queue", queue,
            "message", "Queue '" + queue + "' paused and purged"
        );
    }

    public Map<String, Object> resumeQueue(String queue) {
        taskDispatcher.setPaused(queue, false);
        return Map.of(
            "status", "resumed",
            "queue", queue,
            "message", "Queue '" + queue + "' resumed"
        );
    }

    public Map<String, Object> pauseAll() {
        for (String queue : taskDispatcher.getAllQueues()) {
            taskDispatcher.setPaused(queue, true);
            taskDispatcher.purgeQueue(queue);
        }
        return Map.of(
            "status", "paused",
            "queues", taskDispatcher.getAllQueues(),
            "message", "All queues paused and purged"
        );
    }

    public Map<String, Object> resumeAll() {
        for (String queue : taskDispatcher.getAllQueues()) {
            taskDispatcher.setPaused(queue, false);
        }
        return Map.of(
            "status", "resumed",
            "queues", taskDispatcher.getAllQueues(),
            "message", "All queues resumed"
        );
    }

    public Map<String, Object> getPauseStatus() {
        Map<String, Object> result = new HashMap<>();
        result.put("queues", taskDispatcher.getPauseStatus());
        return result;
    }

    /**
     * Backfill duration_ms from Spotify for tracks where it is 0 or NULL.
     */
    public Map<String, Object> backfillDuration(int batchSize) {
        taskDispatcher.dispatchBackfillDuration(batchSize);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("batchSize", batchSize);
        result.put("message", "Duration backfill task queued for up to " + batchSize + " tracks");
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
        result.put("taskId", taskId);
        result.put("limit", limit);
        result.put("message", "ISRC backfill task queued for up to " + limit + " tracks");
        return result;
    }
}
