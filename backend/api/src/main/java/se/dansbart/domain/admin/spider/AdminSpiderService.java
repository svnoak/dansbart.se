package se.dansbart.domain.admin.spider;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.admin.ArtistCrawlLog;
import se.dansbart.domain.admin.ArtistCrawlLogJooqRepository;
import se.dansbart.worker.TaskDispatcher;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminSpiderService {

    private final ArtistCrawlLogJooqRepository crawlLogRepository;
    private final TaskDispatcher taskDispatcher;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Trigger spider crawl.
     */
    public Map<String, Object> triggerSpiderCrawl(String mode, int maxDiscoveries, boolean discoverFromAlbums) {
        // Dispatch the spider crawl task
        taskDispatcher.dispatchSpiderCrawl(null);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "queued");
        result.put("message", "Spider crawl queued in background (" + mode + " mode)");
        result.put("taskId", UUID.randomUUID().toString());
        result.put("mode", mode);
        result.put("parameters", Map.of(
            "maxDiscoveries", maxDiscoveries,
            "discoverFromAlbums", discoverFromAlbums
        ));
        return result;
    }

    /**
     * Get crawl history.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getCrawlHistory(int limit, int offset) {
        Page<ArtistCrawlLog> page = crawlLogRepository.findAllByOrderByCrawledAtDesc(
            PageRequest.of(offset / limit, limit)
        );

        List<Map<String, Object>> items = page.getContent().stream()
            .map(log -> {
                Map<String, Object> item = new HashMap<>();
                item.put("id", log.getId().toString());
                item.put("artistName", log.getArtistName());
                item.put("spotifyId", log.getSpotifyArtistId());
                item.put("tracksFound", log.getTracksFound());
                item.put("musicGenre", log.getMusicGenreClassification());
                item.put("detectedGenres", log.getDetectedGenres());
                item.put("status", log.getStatus());
                item.put("discoverySource", log.getDiscoverySource());
                item.put("crawledAt", log.getCrawledAt() != null ? log.getCrawledAt().toString() : null);
                return item;
            })
            .toList();

        Map<String, Object> result = new HashMap<>();
        result.put("items", items);
        result.put("total", page.getTotalElements());
        result.put("limit", limit);
        result.put("offset", offset);
        return result;
    }

    /**
     * Get spider statistics.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getSpiderStats() {
        long totalCrawled = crawlLogRepository.countLogs();
        Long totalTracks = crawlLogRepository.sumTracksFound();

        Map<String, Long> byGenre = new HashMap<>();
        for (Object[] row : crawlLogRepository.countByMusicGenre()) {
            if (row[0] != null) {
                byGenre.put((String) row[0], (Long) row[1]);
            }
        }

        Map<String, Long> byStatus = new HashMap<>();
        for (Object[] row : crawlLogRepository.countByStatus()) {
            byStatus.put((String) row[0], (Long) row[1]);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalArtistsCrawled", totalCrawled);
        result.put("totalTracksFound", totalTracks != null ? totalTracks : 0);
        result.put("byGenre", byGenre);
        result.put("byStatus", byStatus);
        return result;
    }

    /**
     * Get status of a spider task from Celery result backend.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> getTaskStatus(String taskId) {
        Map<String, Object> result = new HashMap<>();
        result.put("taskId", taskId);

        try {
            // Celery stores task results in Redis with this key pattern
            String resultKey = "celery-task-meta-" + taskId;
            String taskResult = redisTemplate.opsForValue().get(resultKey);

            if (taskResult != null) {
                Map<String, Object> celeryResult = objectMapper.readValue(taskResult, Map.class);
                String status = (String) celeryResult.getOrDefault("status", "UNKNOWN");
                result.put("state", status);

                if ("SUCCESS".equals(status)) {
                    result.put("result", celeryResult.get("result"));
                    result.put("progress", 100);
                } else if ("FAILURE".equals(status)) {
                    result.put("error", celeryResult.get("result"));
                    result.put("progress", 0);
                } else if ("PROGRESS".equals(status) || "STARTED".equals(status)) {
                    Object taskMeta = celeryResult.get("result");
                    if (taskMeta instanceof Map) {
                        Map<String, Object> meta = (Map<String, Object>) taskMeta;
                        result.put("progress", meta.getOrDefault("progress", 0));
                        result.put("current", meta.get("current"));
                        result.put("total", meta.get("total"));
                        result.put("message", meta.get("message"));
                    } else {
                        result.put("progress", 0);
                    }
                } else {
                    result.put("progress", 0);
                }
            } else {
                // Task not found - could be pending or expired
                result.put("state", "PENDING");
                result.put("progress", 0);
                result.put("message", "Task is queued or result has expired");
            }
        } catch (Exception e) {
            log.error("Error getting task status for {}: {}", taskId, e.getMessage());
            result.put("state", "UNKNOWN");
            result.put("error", "Failed to retrieve task status");
        }

        return result;
    }
}
