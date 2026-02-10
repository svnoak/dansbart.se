package se.dansbart.domain.admin.track;

import se.dansbart.dto.ArtistSummaryDto;
import se.dansbart.dto.AlbumSummaryDto;
import se.dansbart.dto.PlaybackLinkDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO for admin track list view with all relationships.
 */
public record AdminTrackDto(
    UUID id,
    String title,
    String isrc,
    Integer durationMs,
    Float tempoBpm,
    OffsetDateTime createdAt,
    String processingStatus,
    Boolean isFlagged,
    String flagReason,
    Boolean hasVocals,
    String musicGenre,
    Float genreConfidence,
    List<ArtistSummaryDto> artists,
    AlbumSummaryDto album,
    List<PlaybackLinkDto> playbackLinks,
    String danceStyle,
    String subStyle,
    String tempoCategory,
    Float confidence
) {}
