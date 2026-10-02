package se.dansbart.domain.track;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import se.dansbart.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PrivateTrackGuard {

    private final UserTrackSourceJooqRepository sourceRepository;

    /** Throws not found when the track is private and the viewer holds no source for it. */
    public void requireVisible(UUID trackId, UUID viewerId) {
        if (!hiddenTrackIds(List.of(trackId), viewerId).isEmpty()) {
            throw new ResourceNotFoundException("Track", trackId);
        }
    }

    public Set<UUID> hiddenTrackIds(List<UUID> trackIds, UUID viewerId) {
        if (trackIds.isEmpty()) return Set.of();
        return sourceRepository.findPrivateTrackIdsWithoutHolder(trackIds, viewerId);
    }
}
