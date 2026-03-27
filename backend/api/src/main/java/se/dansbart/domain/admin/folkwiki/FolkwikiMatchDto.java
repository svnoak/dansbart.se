package se.dansbart.domain.admin.folkwiki;

import se.dansbart.dto.PlaybackLinkDto;

import java.util.List;
import java.util.UUID;

public record FolkwikiMatchDto(
    UUID trackId,
    String trackTitle,
    String dbStyle,
    String dbSubStyle,
    Float dbConfidence,
    String classificationSource,
    Integer folkwikiTuneId,
    String folkwikiId,
    String folkwikiTitle,
    String folkwikiStyle,
    String folkwikiMeter,
    Integer folkwikiBpb,
    String folkwikiUrl,
    String matchType,
    String matchStatus,
    List<PlaybackLinkDto> playbackLinks
) {}
