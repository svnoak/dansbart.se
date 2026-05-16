package se.dansbart.domain.dance;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import se.dansbart.domain.track.TrackJooqRepository;
import se.dansbart.dto.TrackListDto;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DancePrimaryTrackService {

    private final DancePrimaryTrackJooqRepository repository;
    private final TrackJooqRepository trackJooqRepository;

    @Transactional
    public void set(UUID userId, UUID danceId, UUID trackId) {
        repository.set(userId, danceId, trackId);
    }

    @Transactional
    public void clear(UUID userId, UUID danceId) {
        repository.clear(userId, danceId);
    }

    public Optional<TrackListDto> get(UUID userId, UUID danceId) {
        return repository.findTrackId(userId, danceId).flatMap(trackId -> {
            List<TrackListDto> tracks = trackJooqRepository.findTrackListDtosByIds(List.of(trackId));
            return tracks.isEmpty() ? Optional.empty() : Optional.of(tracks.get(0));
        });
    }
}
