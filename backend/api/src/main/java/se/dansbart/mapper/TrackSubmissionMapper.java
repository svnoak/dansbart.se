package se.dansbart.mapper;

import org.springframework.stereotype.Component;
import se.dansbart.domain.submission.TrackSubmission;
import se.dansbart.dto.TrackSubmissionDto;

@Component
public class TrackSubmissionMapper {

    public TrackSubmissionDto toDto(TrackSubmission s, boolean includeSubmitter) {
        return TrackSubmissionDto.builder()
            .id(s.getId())
            .batchId(s.getBatchId())
            .provider(s.getProvider())
            .sourceKind(s.getSourceKind())
            .sourceName(s.getSourceName())
            .sourceUrl(s.getSourceUrl())
            .externalId(s.getExternalId())
            .title(s.getTitle())
            .artistName(s.getArtistName())
            .albumName(s.getAlbumName())
            .suggestedMainStyle(s.getSuggestedMainStyle())
            .suggestedSubStyle(s.getSuggestedSubStyle())
            .status(s.getStatus())
            .trackId(s.getTrackId())
            .trackStatus(s.getTrackProcessingStatus())
            .submitterName(includeSubmitter ? s.getSubmitterUsername() : null)
            .createdAt(s.getCreatedAt())
            .reviewedAt(s.getReviewedAt())
            .reviewNote(s.getReviewNote())
            .build();
    }
}
