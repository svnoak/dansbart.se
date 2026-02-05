package se.dansbart.worker;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dispatches tasks to Python Celery workers via Redis.
 *
 * Publishes Celery-compatible JSON messages to Redis queues
 * that the Python workers consume.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TaskDispatcher {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String AUDIO_QUEUE = "audio";
    private static final String FEATURE_QUEUE = "feature";
    private static final String LIGHT_QUEUE = "light";

    /**
     * Dispatch audio analysis task to the AGPL audio worker.
     */
    public void dispatchAudioAnalysis(UUID trackId) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_audio.analyze_track_task",
            List.of(trackId.toString()),
            Map.of()
        );
        pushToQueue(AUDIO_QUEUE, taskMessage);
        log.info("Dispatched audio analysis for track {}", trackId);
    }

    /**
     * Dispatch library reclassification task to the feature worker.
     */
    public void dispatchReclassifyLibrary() {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_feature.reclassify_library_task",
            List.of(),
            Map.of()
        );
        pushToQueue(FEATURE_QUEUE, taskMessage);
        log.info("Dispatched library reclassification");
    }

    /**
     * Dispatch single track classification to the feature worker.
     */
    public void dispatchClassifyTrack(UUID trackId, Map<String, Object> analysisData) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_feature.classify_track_task",
            List.of(trackId.toString()),
            Map.of("analysis_data", analysisData)
        );
        pushToQueue(FEATURE_QUEUE, taskMessage);
        log.info("Dispatched classification for track {}", trackId);
    }

    /**
     * Dispatch spider crawl task to the light worker.
     */
    public void dispatchSpiderCrawl(String seedArtistId) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.spider_crawl_task",
            seedArtistId != null ? List.of(seedArtistId) : List.of(),
            Map.of()
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched spider crawl with seed: {}", seedArtistId);
    }

    /**
     * Dispatch artist backfill task to the light worker.
     */
    public void dispatchBackfillArtist(UUID artistId) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.backfill_artist_task",
            List.of(artistId.toString()),
            Map.of()
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched backfill for artist {}", artistId);
    }

    /**
     * Dispatch ISRC backfill task to the light worker.
     */
    public void dispatchBackfillIsrcs(int limit) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.backfill_isrcs_task",
            List.of(),
            Map.of("limit", limit)
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched ISRC backfill with limit {}", limit);
    }

    /**
     * Dispatch Spotify preview task to the light worker.
     * Used to fetch metadata from Spotify without ingesting tracks.
     */
    public void dispatchSpotifyPreview(String previewType, String spotifyId) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.spotify_preview_task",
            List.of(previewType, spotifyId),
            Map.of()
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched Spotify preview {} for {}", previewType, spotifyId);
    }

    /**
     * Dispatch Spotify ingestion task to the light worker.
     * Used to ingest albums or tracks from Spotify.
     */
    public void dispatchSpotifyIngest(String resourceType, String spotifyId) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.spotify_ingest_task",
            List.of(resourceType, spotifyId),
            Map.of()
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched Spotify ingest {} for {}", resourceType, spotifyId);
    }

    /**
     * Build a Celery-compatible task message.
     *
     * Celery message format:
     * {
     *   "id": "unique-task-id",
     *   "task": "module.path.task_name",
     *   "args": [...],
     *   "kwargs": {...},
     *   "retries": 0,
     *   "eta": null
     * }
     */
    private String buildCeleryMessage(String taskName, List<Object> args, Map<String, Object> kwargs) {
        Map<String, Object> message = Map.of(
            "id", UUID.randomUUID().toString(),
            "task", taskName,
            "args", args,
            "kwargs", kwargs,
            "retries", 0,
            "eta", (Object) null
        );

        // Celery expects the message body + content metadata
        Map<String, Object> celeryMessage = Map.of(
            "body", encodeBase64(message),
            "content-encoding", "utf-8",
            "content-type", "application/json",
            "headers", Map.of(),
            "properties", Map.of(
                "correlation_id", UUID.randomUUID().toString(),
                "delivery_mode", 2,
                "delivery_info", Map.of(
                    "exchange", "",
                    "routing_key", taskName.contains("audio") ? AUDIO_QUEUE :
                                   taskName.contains("feature") ? FEATURE_QUEUE : LIGHT_QUEUE
                ),
                "priority", 0,
                "body_encoding", "base64"
            )
        );

        try {
            return objectMapper.writeValueAsString(celeryMessage);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize Celery message", e);
        }
    }

    private String encodeBase64(Map<String, Object> message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            return java.util.Base64.getEncoder().encodeToString(json.getBytes());
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to encode message body", e);
        }
    }

    private void pushToQueue(String queue, String message) {
        redisTemplate.opsForList().leftPush(queue, message);
    }
}
