package se.dansbart.dto;

import java.util.UUID;

/**
 * Result of adding a track.
 * status is CREATED (new track, analysis started), QUEUED (Spotify ingest started; the
 * track appears once the worker has fetched it) or EXISTS (the library already had the
 * track; the chosen dance style was recorded as a vote).
 */
public record TrackSubmissionResultDto(UUID submissionId, UUID trackId, String status) {}
