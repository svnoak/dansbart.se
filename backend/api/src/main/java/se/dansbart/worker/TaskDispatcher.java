package se.dansbart.worker;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import org.slf4j.MDC;

import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
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

    private static final List<String> ALL_QUEUES = List.of(AUDIO_QUEUE, FEATURE_QUEUE, LIGHT_QUEUE);
    private static final String PAUSE_KEY_PREFIX = "dansbart:paused:";
    private static final String RETRAIN_COOLDOWN_KEY = "dansbart:retrain:cooldown";
    private static final Duration RETRAIN_COOLDOWN = Duration.ofHours(1);

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
     * Dispatch bar correction task to the feature worker.
     * Re-derives bar positions from stored beat times using the confirmed dance style.
     */
    public void dispatchCorrectBars(UUID trackId, String mainStyle, String subStyle) {
        Map<String, Object> kwargs = new java.util.HashMap<>();
        if (subStyle != null) kwargs.put("sub_style", subStyle);
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_feature.correct_bars_task",
            List.of(trackId.toString(), mainStyle),
            kwargs
        );
        pushToQueue(FEATURE_QUEUE, taskMessage);
        log.info("Dispatched bar correction for track {} style {}", trackId, mainStyle);
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
     * Must pass the artist's Spotify ID (e.g. from PendingArtistApproval or Artist.spotifyId).
     */
    public void dispatchBackfillArtist(String spotifyArtistId) {
        if (spotifyArtistId == null || spotifyArtistId.isBlank()) {
            log.warn("Cannot dispatch backfill: spotifyArtistId is null or blank");
            return;
        }
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.backfill_artist_task",
            List.of(spotifyArtistId),
            Map.of()
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched backfill for artist (Spotify ID) {}", spotifyArtistId);
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
     * Dispatch duration backfill task to the light worker.
     */
    public void dispatchBackfillDuration(int batchSize) {
        String taskMessage = buildCeleryMessage(
            "app.workers.tasks_light.backfill_duration_task",
            List.of(),
            Map.of("batch_size", batchSize)
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched duration backfill with batch_size {}", batchSize);
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
     * Dispatch model retrain task to the light worker (bypasses cooldown).
     */
    public void dispatchRetrainModel(boolean reclassifyAfter) {
        String taskMessage = buildCeleryMessage(
            "retrain_model_task",
            List.of(),
            Map.of("reclassify_after", reclassifyAfter)
        );
        pushToQueue(LIGHT_QUEUE, taskMessage);
        log.info("Dispatched model retrain (reclassify={})", reclassifyAfter);
    }

    /**
     * Dispatch model retrain with 1-hour debounce via Redis cooldown key.
     */
    public void dispatchRetrainModelDebounced(boolean reclassifyAfter) {
        Boolean wasAbsent = redisTemplate.opsForValue()
            .setIfAbsent(RETRAIN_COOLDOWN_KEY, "1", RETRAIN_COOLDOWN);
        if (Boolean.TRUE.equals(wasAbsent)) {
            dispatchRetrainModel(reclassifyAfter);
        } else {
            log.debug("Retrain cooldown active, skipping dispatch");
        }
    }

    public boolean isPaused(String queue) {
        return Boolean.TRUE.toString().equals(
            redisTemplate.opsForValue().get(PAUSE_KEY_PREFIX + queue));
    }

    public void setPaused(String queue, boolean paused) {
        String key = PAUSE_KEY_PREFIX + queue;
        if (paused) {
            redisTemplate.opsForValue().set(key, "true");
        } else {
            redisTemplate.delete(key);
        }
    }

    public void purgeQueue(String queue) {
        Long removed = redisTemplate.delete(queue) ? 1L : 0L;
        log.info("Purged queue '{}' (key deleted: {})", queue, removed == 1L);
    }

    public Map<String, Boolean> getPauseStatus() {
        Map<String, Boolean> status = new LinkedHashMap<>();
        for (String queue : ALL_QUEUES) {
            status.put(queue, isPaused(queue));
        }
        return status;
    }

    public List<String> getAllQueues() {
        return ALL_QUEUES;
    }

    private String buildCeleryMessage(String taskName, List<Object> args, Map<String, Object> kwargs) {
        // Celery Redis transport message format (mirrors Python producer):
        // {
        //   "body": base64(json.dumps([args, kwargs, {"callbacks": null, "errbacks": null, "chain": null, "chord": null}])),
        //   "content-encoding": "utf-8",
        //   "content-type": "application/json",
        //   "headers": { ... task metadata ... },
        //   "properties": { ... broker metadata incl. delivery_tag ... }
        // }

        String taskId = UUID.randomUUID().toString();

        // Build body envelope: [args, kwargs, {callbacks, errbacks, chain, chord}]
        Map<String, Object> callbackMeta = new HashMap<>();
        callbackMeta.put("callbacks", null);
        callbackMeta.put("errbacks", null);
        callbackMeta.put("chain", null);
        callbackMeta.put("chord", null);

        List<Object> bodyEnvelope = List.of(args, kwargs, callbackMeta);

        String bodyBase64 = encodeBase64(bodyEnvelope);

        // Headers closely match what Celery generates
        Map<String, Object> headers = new HashMap<>();
        headers.put("lang", "py");
        headers.put("task", taskName);
        headers.put("id", taskId);
        headers.put("shadow", null);
        headers.put("eta", null);
        headers.put("expires", null);
        headers.put("group", null);
        headers.put("group_index", null);
        headers.put("retries", 0);
        headers.put("timelimit", Arrays.asList(null, null));
        headers.put("root_id", taskId);
        headers.put("parent_id", null);
        try {
            headers.put("argsrepr", objectMapper.writeValueAsString(args));
            headers.put("kwargsrepr", objectMapper.writeValueAsString(kwargs));
        } catch (JsonProcessingException e) {
            // Fallback to simple toString representations
            headers.put("argsrepr", args.toString());
            headers.put("kwargsrepr", kwargs.toString());
        }
        headers.put("origin", "java-api");
        String traceId = MDC.get("traceId");
        if (traceId != null) {
            headers.put("trace_id", traceId);
        }
        headers.put("ignore_result", false);
        headers.put("replaced_task_nesting", 0);
        headers.put("stamped_headers", null);
        headers.put("stamps", new HashMap<String, Object>());

        // Determine routing key / queue
        String routingKey = taskName.contains("audio")
            ? AUDIO_QUEUE
            : (taskName.contains("feature") ? FEATURE_QUEUE : LIGHT_QUEUE);

        // Properties including required delivery_tag
        Map<String, Object> properties = new HashMap<>();
        properties.put("correlation_id", taskId);
        properties.put("reply_to", UUID.randomUUID().toString());
        properties.put("delivery_mode", 2);
        Map<String, Object> deliveryInfo = new HashMap<>();
        deliveryInfo.put("exchange", "");
        deliveryInfo.put("routing_key", routingKey);
        properties.put("delivery_info", deliveryInfo);
        properties.put("priority", 0);
        properties.put("body_encoding", "base64");
        properties.put("delivery_tag", UUID.randomUUID().toString());

        // Celery expects the message body + content metadata
        Map<String, Object> celeryMessage = Map.of(
            "body", bodyBase64,
            "content-encoding", "utf-8",
            "content-type", "application/json",
            "headers", headers,
            "properties", properties
        );

        try {
            return objectMapper.writeValueAsString(celeryMessage);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize Celery message", e);
        }
    }

    private String encodeBase64(Object message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            return java.util.Base64.getEncoder().encodeToString(json.getBytes());
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to encode message body", e);
        }
    }

    private void pushToQueue(String queue, String message) {
        if (isPaused(queue)) {
            log.warn("Queue '{}' is paused, skipping dispatch", queue);
            return;
        }
        redisTemplate.opsForList().leftPush(queue, message);
    }
}
